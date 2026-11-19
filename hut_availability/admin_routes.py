from __future__ import annotations

import csv
import hmac
import io
import secrets
from datetime import date, timedelta
from pathlib import Path

from fastapi import APIRouter, Form, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from hut_availability.db import get_session_factory
from hut_availability.models import CheckJob, Hut
from hut_availability.security import (
    expected_admin_key,
    get_csrf_token,
    is_admin_session,
    verify_session_csrf,
)
from hut_availability.services import choose_huts, create_check_job, validate_search

router = APIRouter()
admin_auth_router = APIRouter()
templates = Jinja2Templates(directory=str(Path(__file__).with_name("templates")))


def csrf_token(request: Request) -> str:
    return get_csrf_token(request)


def verify_csrf(request: Request, token: str) -> None:
    verify_session_csrf(request, token)


def login_redirect() -> RedirectResponse:
    return RedirectResponse("/admin/login", status_code=303)


def _nights(start: date, end: date) -> list[date]:
    return [start + timedelta(days=index) for index in range((end - start).days + 1)]


class AdminLoginRequest(BaseModel):
    api_key: str
    csrf_token: str


class AdminLogoutRequest(BaseModel):
    csrf_token: str


@admin_auth_router.get("/admin/auth/session")
def admin_session_status(request: Request):
    return {
        "authenticated": is_admin_session(request),
        "csrf_token": get_csrf_token(request),
    }


@admin_auth_router.post("/admin/auth/login")
def admin_session_login(body: AdminLoginRequest, request: Request):
    verify_session_csrf(request, body.csrf_token)
    if not hmac.compare_digest(body.api_key, expected_admin_key()):
        raise HTTPException(status_code=401, detail="The admin key was not accepted.")
    request.session.clear()
    request.session["is_admin"] = True
    request.session["csrf_token"] = secrets.token_urlsafe(32)
    return {"authenticated": True, "csrf_token": request.session["csrf_token"]}


@admin_auth_router.post("/admin/auth/logout")
def admin_session_logout(body: AdminLogoutRequest, request: Request):
    if not is_admin_session(request):
        raise HTTPException(status_code=401, detail="Admin sign-in required.")
    verify_session_csrf(request, body.csrf_token)
    request.session.clear()
    return {"authenticated": False}


def _dashboard_data(
    session: Session,
    date_from: date,
    date_to: date,
    people: int,
    cluster: str | None,
) -> tuple[list[Hut], dict[tuple[str, date], dict], list[CheckJob], list[date], list[Hut]]:
    huts = list(
        session.scalars(
            select(Hut)
            .where(Hut.active.is_(True))
            .order_by(Hut.cluster, Hut.name)
        )
    )
    params: dict[str, object] = {
        "date_from": date_from,
        "date_to": date_to,
        "people": people,
        "cluster": cluster,
    }
    rows = session.execute(
        text(
            """
            SELECT h.key AS hut_key, h.name, h.cluster, h.booking_url,
                   a.night, a.status, a.beds_free, a.detail, a.checked_at
            FROM latest_availability AS a
            JOIN huts AS h ON h.id = a.hut_id
            WHERE a.night >= :date_from AND a.night <= :date_to
              AND a.people = :people
              AND (CAST(:cluster AS TEXT) IS NULL OR h.cluster = :cluster)
            ORDER BY h.cluster, h.name, a.night
            """
        ),
        params,
    ).mappings()
    grid = {
        (row["hut_key"], row["night"]): dict(row)
        for row in rows
    }
    jobs = list(
        session.scalars(
            select(CheckJob).order_by(CheckJob.created_at.desc(), CheckJob.id.desc()).limit(10)
        )
    )
    manual_huts = [hut for hut in huts if hut.system == "manual"]
    visible_huts = [
        hut for hut in huts
        if cluster is None or hut.cluster == cluster
    ]
    return visible_huts, grid, jobs, _nights(date_from, date_to), manual_huts


@router.get("/admin/login", response_class=HTMLResponse)
def login_page(request: Request):
    if is_admin_session(request):
        return RedirectResponse("/admin", status_code=303)
    return templates.TemplateResponse(
        request=request,
        name="login.html",
        context={"csrf_token": csrf_token(request), "error": None},
    )


@router.post("/admin/login", response_class=HTMLResponse)
def login(
    request: Request,
    api_key: str = Form(...),
    csrf: str = Form(...),
):
    verify_csrf(request, csrf)
    if not hmac.compare_digest(api_key, expected_admin_key()):
        return templates.TemplateResponse(
            request=request,
            name="login.html",
            context={
                "csrf_token": csrf_token(request),
                "error": "That admin key was not accepted.",
            },
            status_code=401,
        )
    request.session.clear()
    request.session["is_admin"] = True
    request.session["csrf_token"] = secrets.token_urlsafe(32)
    return RedirectResponse("/admin", status_code=303)


@router.post("/admin/logout")
def logout(request: Request, csrf: str = Form(...)):
    if not is_admin_session(request):
        return login_redirect()
    verify_csrf(request, csrf)
    request.session.clear()
    return RedirectResponse("/admin/login", status_code=303)


@router.get("/admin", response_class=HTMLResponse)
def dashboard(
    request: Request,
    date_from: date | None = None,
    date_to: date | None = None,
    people: int = Query(default=2, ge=1, le=12),
    cluster: str | None = None,
):
    if not is_admin_session(request):
        return login_redirect()
    start = date_from or date.today()
    end = date_to or (start + timedelta(days=6))
    if end < start:
        raise HTTPException(status_code=422, detail="End date must be on or after start date.")
    if (end - start).days + 1 > 62:
        raise HTTPException(status_code=422, detail="A grid can show at most 62 nights.")

    with get_session_factory()() as session:
        huts, grid, jobs, days, manual_huts = _dashboard_data(
            session, start, end, people, cluster
        )
        clusters = sorted({hut.cluster for hut in session.scalars(select(Hut))})
    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={
            "csrf_token": csrf_token(request),
            "huts": huts,
            "grid": grid,
            "jobs": jobs,
            "days": days,
            "manual_huts": manual_huts,
            "clusters": clusters,
            "date_from": start.isoformat(),
            "date_to": end.isoformat(),
            "people": people,
            "selected_cluster": cluster,
            "error": None,
        },
    )


@router.post("/admin/checks")
def admin_start_check(
    request: Request,
    date_from: date = Form(...),
    date_to: date = Form(...),
    people: int = Form(...),
    clusters: list[str] = Form(default=[]),
    hut_keys: list[str] = Form(default=[]),
    force: str | None = Form(default=None),
    csrf: str = Form(...),
):
    if not is_admin_session(request):
        return login_redirect()
    verify_csrf(request, csrf)
    validate_search(date_from, date_to, people)
    with get_session_factory()() as session:
        huts = choose_huts(session, hut_keys or None, clusters or None)
        job = create_check_job(
            session,
            date_from=date_from,
            date_to=date_to,
            people=people,
            huts=huts,
            requested_by="admin",
            force=force == "on",
        )
    request.app.state.job_queue.put_nowait(job.id)
    return RedirectResponse(f"/admin/jobs/{job.id}", status_code=303)


@router.get("/admin/jobs/{job_id}", response_class=HTMLResponse)
def job_detail(request: Request, job_id: int):
    if not is_admin_session(request):
        return login_redirect()
    with get_session_factory()() as session:
        job = session.get(CheckJob, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Check job not found.")
        huts = list(
            session.scalars(
                select(Hut).where(Hut.key.in_(job.hut_keys)).order_by(Hut.cluster, Hut.name)
            )
        )
    return templates.TemplateResponse(
        request=request,
        name="job.html",
        context={
            "csrf_token": csrf_token(request),
            "job": job,
            "huts": huts,
            "refresh": job.status in {"queued", "running"},
        },
    )


@router.get("/admin/history/{hut_key}", response_class=HTMLResponse)
def hut_history(
    request: Request,
    hut_key: str,
    night: date | None = None,
    people: int = Query(default=2, ge=1, le=12),
):
    if not is_admin_session(request):
        return login_redirect()
    with get_session_factory()() as session:
        hut = session.scalar(select(Hut).where(Hut.key == hut_key))
        if not hut:
            raise HTTPException(status_code=404, detail="Hut not found.")
        rows = []
        if night:
            rows = session.execute(
                text(
                    """
                    SELECT status, beds_free, detail, checked_at
                    FROM availability_checks
                    WHERE hut_id = :hut_id AND night = :night AND people = :people
                    ORDER BY checked_at DESC, id DESC
                    """
                ),
                {"hut_id": hut.id, "night": night, "people": people},
            ).mappings().all()
    return templates.TemplateResponse(
        request=request,
        name="history.html",
        context={
            "csrf_token": csrf_token(request),
            "hut": hut,
            "night": night.isoformat() if night else "",
            "people": people,
            "rows": rows,
        },
    )


@router.get("/admin/export.csv")
def export_grid(
    request: Request,
    date_from: date,
    date_to: date,
    people: int = Query(ge=1, le=12),
    cluster: str | None = None,
):
    if not is_admin_session(request):
        return login_redirect()
    validate_search(date_from, date_to, people)
    with get_session_factory()() as session:
        result = session.execute(
            text(
                """
                SELECT h.key, h.name, h.cluster, a.night, a.people, a.status,
                       a.beds_free, a.detail, a.checked_at, h.booking_url
                FROM latest_availability AS a
                JOIN huts AS h ON h.id = a.hut_id
                WHERE a.night >= :date_from AND a.night <= :date_to
                  AND a.people = :people
                  AND (CAST(:cluster AS TEXT) IS NULL OR h.cluster = :cluster)
                ORDER BY h.cluster, h.name, a.night
                """
            ),
            {
                "date_from": date_from,
                "date_to": date_to,
                "people": people,
                "cluster": cluster,
            },
        ).mappings().all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["hut_key", "hut", "cluster", "night", "people", "status", "beds_free", "detail", "checked_at", "booking_url"]
    )
    for row in result:
        writer.writerow([row[name] for name in row.keys()])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=alta-via-availability.csv"},
    )
