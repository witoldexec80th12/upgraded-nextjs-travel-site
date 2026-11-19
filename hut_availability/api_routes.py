from __future__ import annotations

import asyncio
import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from requests import HTTPError
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from hut_availability.airtable_sync import sync_latest
from hut_availability.db import get_db
from hut_availability.models import CheckJob, Hut
from hut_availability.runner import retry_job_airtable_sync
from hut_availability.security import require_admin_access
from hut_availability.services import choose_huts, create_check_job, validate_search

router = APIRouter(dependencies=[Depends(require_admin_access)])
logger = logging.getLogger(__name__)


class CheckRequest(BaseModel):
    date_from: date
    date_to: date
    people: int = Field(ge=1, le=12)
    huts: list[str] | None = None
    clusters: list[str] | None = None
    force: bool = False


class SyncRequest(BaseModel):
    date_from: date
    date_to: date
    people: int = Field(ge=1, le=12)
    huts: list[str] | None = None


@router.get("/huts")
def list_huts(session: Session = Depends(get_db)):
    huts = session.scalars(select(Hut).order_by(Hut.cluster, Hut.name)).all()
    return [
        {
            "key": hut.key,
            "name": hut.name,
            "cluster": hut.cluster,
            "system": hut.system,
            "active": hut.active,
            "booking_url": hut.booking_url,
            "notes": hut.notes,
        }
        for hut in huts
    ]


@router.post("/checks", status_code=202)
def start_check(body: CheckRequest, request: Request, session: Session = Depends(get_db)):
    validate_search(body.date_from, body.date_to, body.people)
    huts = choose_huts(session, body.huts, body.clusters)
    job = create_check_job(
        session,
        date_from=body.date_from,
        date_to=body.date_to,
        people=body.people,
        huts=huts,
        requested_by="admin",
        force=body.force,
    )
    request.app.state.job_queue.put_nowait(job.id)
    return {"job_id": job.id, "status": job.status}


@router.post("/checks/{job_id}/airtable-sync")
async def retry_job_airtable_sync(job_id: int, session: Session = Depends(get_db)):
    job = session.get(CheckJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Check job not found.")
    if job.status != "done":
        raise HTTPException(status_code=409, detail="Wait for the availability check to finish.")
    try:
        count = await asyncio.to_thread(retry_job_airtable_sync, job_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from None
    if count is None:
        session.refresh(job)
        if job.airtable_status == "done":
            return {"records_upserted": 0, "airtable_status": "done"}
        raise HTTPException(status_code=409, detail="An Airtable sync is already in progress.")
    return {"records_upserted": count, "airtable_status": "done"}


@router.get("/checks/{job_id}")
def check_status(job_id: int, session: Session = Depends(get_db)):
    job = session.get(CheckJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Check job not found.")
    return {
        "job_id": job.id,
        "date_from": job.date_from.isoformat(),
        "date_to": job.date_to.isoformat(),
        "people": job.people,
        "status": job.status,
        "huts_done": job.huts_done,
        "huts_total": job.huts_total,
        "error": job.error,
        "airtable_status": job.airtable_status,
        "airtable_error": job.airtable_error,
        "created_at": job.created_at,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
    }


@router.get("/checks")
def recent_checks(
    limit: int = Query(default=10, ge=1, le=50),
    session: Session = Depends(get_db),
):
    jobs = session.scalars(
        select(CheckJob)
        .order_by(CheckJob.created_at.desc(), CheckJob.id.desc())
        .limit(limit)
    ).all()
    return [
        {
            "job_id": job.id,
            "date_from": job.date_from.isoformat(),
            "date_to": job.date_to.isoformat(),
            "people": job.people,
            "status": job.status,
            "huts_done": job.huts_done,
            "huts_total": job.huts_total,
            "error": job.error,
            "airtable_status": job.airtable_status,
            "airtable_error": job.airtable_error,
            "created_at": job.created_at,
            "started_at": job.started_at,
            "finished_at": job.finished_at,
        }
        for job in jobs
    ]


@router.get("/availability")
def availability(
    date_from: date,
    date_to: date,
    people: int = Query(ge=1, le=12),
    cluster: str | None = None,
    session: Session = Depends(get_db),
):
    validate_search(date_from, date_to, people)
    rows = session.execute(
        text(
            """
            SELECT h.key AS hut_key, h.name, h.cluster, h.booking_url,
                   a.night, a.people, a.status, a.beds_free, a.detail, a.checked_at
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
    ).mappings()
    return [
        {
            **dict(row),
            "night": row["night"].isoformat(),
            "checked_at": row["checked_at"].isoformat(),
        }
        for row in rows
    ]


@router.get("/availability/history")
def availability_history(
    hut: str,
    night: date,
    people: int = Query(ge=1, le=12),
    session: Session = Depends(get_db),
):
    result = session.execute(
        text(
            """
            SELECT h.key AS hut_key, h.name, a.night, a.people, a.status,
                   a.beds_free, a.detail, a.checked_at
            FROM availability_checks AS a
            JOIN huts AS h ON h.id = a.hut_id
            WHERE h.key = :hut AND a.night = :night AND a.people = :people
            ORDER BY a.checked_at DESC, a.id DESC
            """
        ),
        {"hut": hut, "night": night, "people": people},
    ).mappings().all()
    return [
        {
            **dict(row),
            "night": row["night"].isoformat(),
            "checked_at": row["checked_at"].isoformat(),
        }
        for row in result
    ]


@router.post("/airtable/sync")
async def airtable_sync(body: SyncRequest):
    validate_search(body.date_from, body.date_to, body.people)
    try:
        count = await asyncio.to_thread(
            sync_latest,
            body.date_from,
            body.date_to,
            body.people,
            body.huts,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except HTTPError as exc:
        response = getattr(exc, "response", None)
        status = getattr(response, "status_code", None)
        if status == 404:
            detail = (
                "Airtable could not find the configured base or table. "
                "Check the base ID, table name, and PAT access."
            )
        elif status in {401, 403}:
            detail = "Airtable rejected the PAT or it lacks write access to this base."
        else:
            detail = "Airtable rejected the sync request. Check the service configuration."
        logger.warning("Airtable sync request rejected with HTTP status %s.", status or "unknown")
        raise HTTPException(status_code=502, detail=detail) from None
    except Exception as exc:
        logger.warning("Airtable sync failed with %s.", type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail="Airtable sync failed. Check the service configuration.",
        ) from None
    return {"records_upserted": count}
