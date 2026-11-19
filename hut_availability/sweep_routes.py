from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from hut_availability.db import get_db
from hut_availability.google_sheets import (
    create_availability_spreadsheet,
    initialize_existing_spreadsheet,
)
from hut_availability.models import (
    AvailabilityCheck,
    CheckJob,
    Hut,
    SweepRun,
    SweepSettings,
)
from hut_availability.security import require_admin_access
from hut_availability.sweep import (
    MAX_NIGHTS_PER_JOB,
    _latest_error_count,
    get_or_create_settings,
    retry_failed_sweep,
    retry_sweep_export,
    settings_payload,
    split_date_range,
)

router = APIRouter(prefix="/api/sweep", dependencies=[Depends(require_admin_access)])
logger = logging.getLogger(__name__)


class SweepSettingsRequest(BaseModel):
    enabled: bool = False
    date_from: date
    date_to: date
    people: int = Field(ge=1, le=12)
    timezone: str = Field(min_length=1, max_length=80)
    run_at: time

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Choose a recognized time zone.") from exc
        return value

    @model_validator(mode="after")
    def valid_range(self):
        if self.date_to < self.date_from:
            raise ValueError("The last night must be on or after the first night.")
        if (self.date_to - self.date_from).days > 539:
            raise ValueError("The daily scan range cannot exceed 540 nights.")
        if self.run_at.tzinfo is not None:
            raise ValueError("Use a local time without a UTC offset.")
        return self


class SweepPilotRequest(BaseModel):
    date_from: date
    date_to: date
    people: int = Field(ge=1, le=12)

    @model_validator(mode="after")
    def valid_pilot_range(self):
        if self.date_to < self.date_from:
            raise ValueError("The last stay date must be on or after the first.")
        if (self.date_to - self.date_from).days + 1 > 7:
            raise ValueError("A one-time pilot can cover at most seven stay dates.")
        return self


def _run_payload(session: Session, run: SweepRun | None) -> dict | None:
    if not run:
        return None
    jobs = list(
        session.scalars(
            select(CheckJob).where(CheckJob.sweep_run_id == run.id)
        )
    )
    by_hut: dict[str, list[str]] = {}
    for job in jobs:
        for key in job.hut_keys:
            by_hut.setdefault(key, []).append(job.status)
    completed_huts = sum(all(status == "done" for status in statuses) for statuses in by_hut.values())
    error_count = _latest_error_count(session, run.id)
    return {
        "run_id": run.id,
        "run_date": run.run_date.isoformat(),
        "date_from": run.date_from.isoformat(),
        "date_to": run.date_to.isoformat(),
        "people": run.people,
        "status": run.status,
        "sheets_status": run.sheets_status,
        "sheets_error": run.sheets_error,
        "error": run.error,
        "huts_total": run.huts_total,
        "huts_done": completed_huts,
        "manual_huts": run.manual_huts,
        "error_count": error_count,
        "batches_total": len(jobs),
        "batches_done": sum(job.status == "done" for job in jobs),
        "batches_failed": sum(job.status == "failed" for job in jobs),
        "created_at": run.created_at,
        "finished_at": run.finished_at,
    }


@router.get("/settings")
def read_settings(session: Session = Depends(get_db)):
    settings = get_or_create_settings(session)
    session.commit()
    return settings_payload(settings)


@router.post("/settings")
def save_settings(body: SweepSettingsRequest, session: Session = Depends(get_db)):
    settings = get_or_create_settings(session)
    if body.enabled and not settings.spreadsheet_id:
        raise HTTPException(
            status_code=409,
            detail="Connect Google Sheets and create the availability workbook before enabling the daily scan.",
        )
    settings.enabled = body.enabled
    settings.date_from = body.date_from
    settings.date_to = body.date_to
    settings.people = body.people
    settings.timezone = body.timezone
    settings.run_at = body.run_at
    session.commit()
    return settings_payload(settings)


@router.get("/latest")
def latest_sweep(session: Session = Depends(get_db)):
    run = session.scalar(select(SweepRun).order_by(SweepRun.run_date.desc()).limit(1))
    return _run_payload(session, run)


@router.post("/sheets/setup")
def setup_sheets(session: Session = Depends(get_db)):
    settings = get_or_create_settings(session)
    huts = list(
        session.scalars(
            select(Hut)
            .where(Hut.active.is_(True))
            .order_by(Hut.cluster, Hut.name)
        )
    )
    try:
        if settings.spreadsheet_id:
            initialize_existing_spreadsheet(
                settings.spreadsheet_id, huts, settings.date_from, settings.date_to
            )
            result = {
                "spreadsheet_id": settings.spreadsheet_id,
                "spreadsheet_url": (
                    f"https://docs.google.com/spreadsheets/d/{settings.spreadsheet_id}/edit"
                ),
            }
        else:
            result = create_availability_spreadsheet(
                huts, settings.date_from, settings.date_to, settings.timezone
            )
            settings.spreadsheet_id = result["spreadsheet_id"]
            session.commit()
            initialize_existing_spreadsheet(
                settings.spreadsheet_id, huts, settings.date_from, settings.date_to
            )
    except Exception as exc:
        session.rollback()
        if isinstance(exc, RuntimeError):
            detail = str(exc)
        else:
            detail = "Could not prepare the Google Sheets workbook. Check the service logs."
        raise HTTPException(status_code=502, detail=detail) from None
    return {**result, **settings_payload(settings)}


@router.post("/pilot", status_code=202)
def start_sweep_pilot(
    body: SweepPilotRequest,
    request: Request,
    session: Session = Depends(get_db),
):
    queue = getattr(request.app.state, "job_queue", None)
    if queue is None:
        raise HTTPException(status_code=503, detail="The availability worker is not ready.")

    try:
        settings = session.scalar(
            select(SweepSettings)
            .where(SweepSettings.id == 1)
            .with_for_update()
        )
        if not settings:
            settings = get_or_create_settings(session)
        if settings.enabled:
            raise HTTPException(
                status_code=409,
                detail="Pause the daily schedule before running a one-time pilot.",
            )
        if not settings.spreadsheet_id:
            raise HTTPException(
                status_code=409,
                detail="Create the Google Sheets workbook before running a pilot.",
            )

        zone = ZoneInfo(settings.timezone)
        run_date = datetime.now(zone).date()
        if body.date_from < run_date:
            raise HTTPException(
                status_code=422,
                detail="A pilot can only check today or future stay dates.",
            )
        existing = session.scalar(
            select(SweepRun)
            .where(SweepRun.run_date == run_date)
            .with_for_update()
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail="A sweep already exists for today's local date.",
            )

        active_huts = list(
            session.scalars(
                select(Hut)
                .where(Hut.active.is_(True))
                .order_by(Hut.cluster, Hut.name)
            )
        )
        automatic_huts = [hut for hut in active_huts if hut.system != "manual"]
        if not automatic_huts:
            raise HTTPException(
                status_code=409,
                detail="There are no active huts with an automatic checker.",
            )

        run = SweepRun(
            run_date=run_date,
            date_from=body.date_from,
            date_to=body.date_to,
            people=body.people,
            timezone=settings.timezone,
            status="queued",
            sheets_status="pending",
            huts_total=len(automatic_huts),
            manual_huts=sum(hut.system == "manual" for hut in active_huts),
        )
        session.add(run)
        session.flush()

        job_ids = []
        for hut in automatic_huts:
            for batch_from, batch_to in split_date_range(
                body.date_from, body.date_to, MAX_NIGHTS_PER_JOB
            ):
                job = CheckJob(
                    requested_by="daily_sweep",
                    date_from=batch_from,
                    date_to=batch_to,
                    people=body.people,
                    hut_keys=[hut.key],
                    force=True,
                    status="queued",
                    sweep_run_id=run.id,
                )
                session.add(job)
                session.flush()
                job_ids.append(job.id)
        run_id = run.id
        session.commit()
    except HTTPException:
        session.rollback()
        raise
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail="A sweep already exists for today's local date.",
        ) from None
    except ZoneInfoNotFoundError:
        session.rollback()
        raise HTTPException(
            status_code=500,
            detail="The configured schedule time zone is invalid.",
        ) from None
    except Exception:
        logger.exception("Failed to queue one-time sweep pilot")
        session.rollback()
        raise HTTPException(
            status_code=500,
            detail="The one-time pilot could not be queued.",
        ) from None

    for job_id in job_ids:
        queue.put_nowait(job_id)
    return {
        "run_id": run_id,
        "run_date": run_date.isoformat(),
        "date_from": body.date_from.isoformat(),
        "date_to": body.date_to.isoformat(),
        "people": body.people,
        "status": "queued",
        "queued_batches": len(job_ids),
        "huts_total": len(automatic_huts),
        "manual_huts": sum(hut.system == "manual" for hut in active_huts),
        "schedule_enabled": False,
    }


@router.post("/runs/{run_id}/retry")
def retry_sweep(run_id: int, request: Request):
    try:
        job_ids = retry_failed_sweep(run_id, request.app.state.job_queue)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not job_ids:
        raise HTTPException(
            status_code=409,
            detail="This sweep has no failed batches or error results to retry.",
        )
    return {"run_id": run_id, "queued_batches": len(job_ids)}


@router.post("/runs/{run_id}/sheets-retry")
async def retry_sheets(run_id: int):
    try:
        await asyncio.to_thread(retry_sweep_export, run_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)[:500]) from None
    return {"run_id": run_id, "sheets_status": "done"}
