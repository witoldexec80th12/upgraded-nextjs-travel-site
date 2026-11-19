from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from hut_availability.db import get_session_factory
from hut_availability.google_sheets import sync_sweep_run
from hut_availability.models import (
    AvailabilityCheck,
    CheckJob,
    Hut,
    SweepRun,
    SweepSettings,
)

logger = logging.getLogger(__name__)
MAX_NIGHTS_PER_JOB = 62


def split_date_range(start: date, end: date, max_nights: int = MAX_NIGHTS_PER_JOB):
    if max_nights < 1:
        raise ValueError("max_nights must be positive.")
    current = start
    while current <= end:
        batch_end = min(end, current + timedelta(days=max_nights - 1))
        yield current, batch_end
        current = batch_end + timedelta(days=1)


def settings_payload(settings: SweepSettings) -> dict:
    return {
        "enabled": settings.enabled,
        "date_from": settings.date_from.isoformat(),
        "date_to": settings.date_to.isoformat(),
        "people": settings.people,
        "timezone": settings.timezone,
        "run_at": settings.run_at.strftime("%H:%M"),
        "spreadsheet_id": settings.spreadsheet_id,
        "spreadsheet_url": (
            f"https://docs.google.com/spreadsheets/d/{settings.spreadsheet_id}/edit"
            if settings.spreadsheet_id
            else None
        ),
    }


def _completed_huts(jobs: list[CheckJob]) -> int:
    by_hut: dict[str, list[str]] = {}
    for job in jobs:
        for key in job.hut_keys:
            by_hut.setdefault(key, []).append(job.status)
    return sum(
        all(status == "done" for status in statuses)
        for statuses in by_hut.values()
    )


def _latest_error_count(session: Session, run_id: int) -> int:
    latest = (
        select(
            AvailabilityCheck.status.label("status"),
            func.row_number()
            .over(
                partition_by=(AvailabilityCheck.hut_id, AvailabilityCheck.night),
                order_by=AvailabilityCheck.id.desc(),
            )
            .label("position"),
        )
        .join(CheckJob, CheckJob.id == AvailabilityCheck.job_id)
        .where(CheckJob.sweep_run_id == run_id)
        .subquery()
    )
    return session.scalar(
        select(func.count()).select_from(latest).where(
            latest.c.position == 1,
            latest.c.status == "error",
        )
    ) or 0


def get_or_create_settings(session: Session) -> SweepSettings:
    settings = session.get(SweepSettings, 1)
    if settings:
        return settings
    settings = SweepSettings(
        id=1,
        enabled=False,
        date_from=date(2026, 6, 1),
        date_to=date(2027, 10, 31),
        people=2,
        timezone="Europe/Madrid",
        run_at=time(3, 0),
    )
    session.add(settings)
    session.flush()
    return settings


def maybe_schedule_daily_sweep(queue: asyncio.Queue[int], now: datetime | None = None) -> int | None:
    """Create one persistent sweep per local date after its configured run time."""
    factory = get_session_factory()
    job_ids: list[int] = []
    run_id: int | None = None
    with factory() as session:
        with session.begin():
            settings = session.scalar(
                select(SweepSettings).where(SweepSettings.id == 1).with_for_update()
            )
            if not settings or not settings.enabled or not settings.spreadsheet_id:
                return None
            try:
                zone = ZoneInfo(settings.timezone)
            except ZoneInfoNotFoundError:
                logger.error("Daily sweep timezone is invalid; scheduling is paused.")
                return None
            local_now = (now or datetime.now(zone)).astimezone(zone)
            run_date = local_now.date()
            if local_now.time().replace(tzinfo=None) < settings.run_at:
                return None
            if run_date > settings.date_to:
                settings.enabled = False
                return None
            if settings.last_scheduled_date == run_date:
                return None
            existing = session.scalar(
                select(SweepRun).where(SweepRun.run_date == run_date)
            )
            if existing:
                settings.last_scheduled_date = run_date
                return None
            active_huts = list(
                session.scalars(
                    select(Hut)
                    .where(Hut.active.is_(True))
                    .order_by(Hut.cluster, Hut.name)
                )
            )
            automatic_huts = [hut for hut in active_huts if hut.system != "manual"]
            if not automatic_huts:
                return None
            scan_start = max(settings.date_from, run_date)
            manual_count = sum(hut.system == "manual" for hut in active_huts)
            run = SweepRun(
                run_date=run_date,
                date_from=scan_start,
                date_to=settings.date_to,
                people=settings.people,
                timezone=settings.timezone,
                status="queued",
                sheets_status="pending",
                huts_total=len(automatic_huts),
                manual_huts=manual_count,
            )
            session.add(run)
            session.flush()
            run_id = run.id
            for hut in automatic_huts:
                for batch_from, batch_to in split_date_range(
                    scan_start, settings.date_to
                ):
                    job = CheckJob(
                        requested_by="daily_sweep",
                        date_from=batch_from,
                        date_to=batch_to,
                        people=settings.people,
                        hut_keys=[hut.key],
                        force=True,
                        status="queued",
                        sweep_run_id=run.id,
                    )
                    session.add(job)
                    session.flush()
                    job_ids.append(job.id)
            settings.last_scheduled_date = run_date
    for job_id in job_ids:
        queue.put_nowait(job_id)
    return run_id


async def scheduler(queue: asyncio.Queue[int]) -> None:
    while True:
        try:
            await asyncio.to_thread(maybe_schedule_daily_sweep, queue)
            from hut_availability.runner import sync_pending_airtable

            await asyncio.to_thread(sync_pending_airtable)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Daily availability scheduler tick failed.")
        await asyncio.sleep(60)


def finalize_sweep_if_ready(run_id: int) -> None:
    factory = get_session_factory()
    should_export = False
    with factory() as session:
        with session.begin():
            run = session.scalar(
                select(SweepRun).where(SweepRun.id == run_id).with_for_update()
            )
            if not run or run.status in {"done", "partial"}:
                return
            jobs = list(
                session.scalars(
                    select(CheckJob).where(CheckJob.sweep_run_id == run_id)
                )
            )
            if not jobs or any(job.status in {"queued", "running"} for job in jobs):
                run.huts_done = _completed_huts(jobs)
                run.status = "running" if any(job.status == "running" for job in jobs) else "queued"
                return
            failed_jobs = sum(job.status == "failed" for job in jobs)
            error_rows = _latest_error_count(session, run_id)
            run.huts_done = _completed_huts(jobs)
            run.status = (
                "partial"
                if failed_jobs or error_rows or run.manual_huts
                else "done"
            )
            run.error = f"{failed_jobs} batch(es) failed." if failed_jobs else None
            run.finished_at = datetime.now().astimezone()
            run.sheets_status = "syncing"
            should_export = True
    if not should_export:
        return
    try:
        sync_sweep_run(run_id)
    except Exception as exc:
        logger.warning("Google Sheets export failed for sweep %s: %s", run_id, exc)
        error = str(exc)[:500]
        with factory() as session:
            run = session.get(SweepRun, run_id)
            if run:
                run.sheets_status = "failed"
                run.sheets_error = error
                session.commit()
        return
    with factory() as session:
        run = session.get(SweepRun, run_id)
        if run:
            run.sheets_status = "done"
            run.sheets_error = None
            session.commit()


def retry_failed_sweep(run_id: int, queue: asyncio.Queue[int]) -> list[int]:
    factory = get_session_factory()
    with factory() as session:
        with session.begin():
            run = session.scalar(
                select(SweepRun).where(SweepRun.id == run_id).with_for_update()
            )
            if not run:
                raise LookupError("Daily sweep was not found.")
            failed_jobs = list(
                session.scalars(
                    select(CheckJob).where(
                        CheckJob.sweep_run_id == run_id,
                        CheckJob.status == "failed",
                    )
                )
            )
            latest_results = (
                select(
                    CheckJob.id.label("job_id"),
                    AvailabilityCheck.status.label("status"),
                    func.row_number()
                    .over(
                        partition_by=(AvailabilityCheck.hut_id, AvailabilityCheck.night),
                        order_by=AvailabilityCheck.id.desc(),
                    )
                    .label("position"),
                )
                .join(AvailabilityCheck, AvailabilityCheck.job_id == CheckJob.id)
                .where(
                    CheckJob.sweep_run_id == run_id,
                    CheckJob.status == "done",
                )
                .subquery()
            )
            error_job_ids = set(
                session.scalars(
                    select(latest_results.c.job_id).where(
                        latest_results.c.position == 1,
                        latest_results.c.status == "error",
                    )
                )
            )
            retry_jobs = {job.id: job for job in failed_jobs}
            for job_id in error_job_ids:
                retry_jobs[job_id] = session.get(CheckJob, job_id)
            if not retry_jobs:
                return []
            ids = []
            for job in retry_jobs.values():
                if not job:
                    continue
                job.status = "queued"
                job.error = None
                job.started_at = None
                job.finished_at = None
                job.huts_done = 0
                job.force = True
                ids.append(job.id)
            run.status = "queued"
            run.error = None
            run.finished_at = None
            run.sheets_status = "pending"
            run.sheets_error = None
    for job_id in ids:
        queue.put_nowait(job_id)
    return ids


def retry_sweep_export(run_id: int) -> None:
    factory = get_session_factory()
    with factory() as session:
        run = session.get(SweepRun, run_id)
        if not run or run.status not in {"done", "partial"}:
            raise LookupError("A completed daily sweep was not found.")
        run.sheets_status = "syncing"
        run.sheets_error = None
        session.commit()
    try:
        sync_sweep_run(run_id)
    except Exception as exc:
        with factory() as session:
            run = session.get(SweepRun, run_id)
            if run:
                run.sheets_status = "failed"
                run.sheets_error = str(exc)[:500]
                session.commit()
        raise
    with factory() as session:
        run = session.get(SweepRun, run_id)
        if run:
            run.sheets_status = "done"
            run.sheets_error = None
            session.commit()
