from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import select, text
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from hut_availability.admin_routes import admin_auth_router, router as admin_router
from hut_availability.api_routes import router as api_router
from hut_availability.sweep_routes import router as sweep_router
from hut_availability.db import get_session_factory
from hut_availability.runner import restore_pending_airtable_syncs, restore_queued_jobs, worker
from hut_availability.sweep import scheduler
from hut_availability.security import expected_admin_key, expected_session_secret

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    expected_admin_key()
    expected_session_secret()
    with get_session_factory()() as session:
        session.execute(text("SELECT 1"))

    queue: asyncio.Queue[int] = asyncio.Queue()
    restore_queued_jobs(queue)
    restore_pending_airtable_syncs()
    app.state.job_queue = queue
    worker_task = asyncio.create_task(worker(queue))
    scheduler_task = asyncio.create_task(scheduler(queue))
    try:
        yield
    finally:
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="Alta Via Hut Availability",
    description="Read-only availability checks for public hut booking engines.",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)
app.add_middleware(
    SessionMiddleware,
    secret_key=expected_session_secret(),
    session_cookie="av1_admin_session",
    same_site="lax",
    https_only=os.getenv("COOKIE_SECURE", "true").lower() != "false",
    max_age=60 * 60 * 12,
)
allowed_admin_origins = [
    origin.strip()
    for origin in os.getenv("ADMIN_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
if any("*" in origin for origin in allowed_admin_origins):
    raise RuntimeError("ADMIN_ALLOWED_ORIGINS must contain exact origins, not wildcards.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_admin_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key", "X-CSRF-Token"],
)


@app.middleware("http")
async def noindex_header(request, call_next):
    response = await call_next(request)
    response.headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(api_router, prefix="/api")
app.include_router(sweep_router)
app.include_router(admin_auth_router)
app.include_router(admin_router)
