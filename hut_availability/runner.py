from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select, update
from requests import HTTPError

from hut_availability.airtable_sync import sync_latest
from hut_availability.checkers import CHECKERS
from hut_availability.db import get_session_factory
from hut_availability.models import AvailabilityCheck, CheckJob, Hut

logger = logging.getLogger(__name__)
CACHE_TTL = timedelta(hours=3)


def contiguous_ranges(days: list[date]) -> list[tuple[date, date]]:
    if not days:
        return []
    ordered = sorted(set(days))
    ranges: list[tuple[date, date]] = []
    start = previous = ordered[0]
    for day in ordered[1:]:
        if day != previous + timedelta(days=1):
            ranges.append((start, previous))
            start = day
        previous = day
    ranges.append((start, previous))
    return ranges


def _cached_nights(
    session,
    hut_id: int,
    requested_days: list[date],
    people: int,
    now: datetime,
) -> set[date]:
    if not requested_days:
        return set()
    ranked = (
        select(
            AvailabilityCheck.night.label("night"),
            AvailabilityCheck.checked_at.label("checked_at"),
            func.row_number()
            .over(
                partition_by=AvailabilityCheck.night,
                order_by=(AvailabilityCheck.checked_at.desc(), AvailabilityCheck.id.desc()),
            )
            .label("row_number"),
        )
        .where(
            AvailabilityCheck.hut_id == hut_id,
            AvailabilityCheck.people == people,
            AvailabilityCheck.night.in_(requested_days),
        )
        .subquery()
    )
    recent = session.execute(
        select(ranked.c.night).where(
            ranked.c.row_number == 1,
            ranked.c.checked_at >= now - CACHE_TTL,
        )
    )
    return {row.night for row in recent}


def run_job(job_id: int) -> None:
    factory = get_session_factory()
    with factory() as session:
        claimed = session.execute(
            update(CheckJob)
            .where(CheckJob.id == job_id, CheckJob.status == "queued")
            .values(
                status="running",
                started_at=datetime.now(timezone.utc),
                finished_at=None,
                error=None,
                huts_done=0,
            )
            .returning(
                CheckJob.date_from,
                CheckJob.date_to,
                CheckJob.people,
                CheckJob.force,
                CheckJob.hut_keys,
                CheckJob.requested_by,
                CheckJob.sweep_run_id,
            )
        ).first()
        if not claimed:
            return
        date_from, date_to, people, force, keys, requested_by, sweep_run_id = claimed
        if sweep_run_id is not None:
            from hut_availability.models import SweepRun

            run = session.get(SweepRun, sweep_run_id)
            if run:
                run.status = "running"
                run.started_at = run.started_at or datetime.now(timezone.utc)
        session.commit()
        requested_days = []
        current = date_from
        while current <= date_to:
            requested_days.append(current)
            current += timedelta(days=1)
        keys = list(keys)

    try:
        with factory() as session:
            huts = list(
                session.scalars(
                    select(Hut)
                    .where(
                        Hut.key.in_(keys),
                        Hut.active.is_(True),
                        Hut.system != "manual",
                    )
                    .order_by(Hut.cluster, Hut.name)
                )
            )
            job = session.get(CheckJob, job_id)
            if not job:
                return
            job.huts_total = len(huts)
            session.commit()

        for hut_snapshot in huts:
            with factory() as session:
                hut = session.get(Hut, hut_snapshot.id)
                if not hut:
                    continue
                now = datetime.now(timezone.utc)
                cached = (
                    set()
                    if force
                    else _cached_nights(session, hut.id, requested_days, people, now)
                )
                missing = [day for day in requested_days if day not in cached]
                session.expunge(hut)

            for range_from, range_to in contiguous_ranges(missing):
                try:
                    checker = CHECKERS[hut_snapshot.system]
                    results = checker(
                        hut_snapshot.name,
                        hut_snapshot.config,
                        range_from,
                        range_to,
                        people,
                    )
                    result_by_night = {row[0]: row for row in results}
                    rows = [
                        result_by_night.get(
                            day,
                            (day, "error", None, "Checker returned no result for this night."),
                        )
                        for day in _days(range_from, range_to)
                    ]
                except Exception as exc:
                    logger.warning("Availability check failed for hut %s: %s", hut_snapshot.key, exc)
                    rows = [
                        (day, "error", None, str(exc)[:500])
                        for day in _days(range_from, range_to)
                    ]

                with factory() as session:
                    for night, status, beds_free, detail in rows:
                        if status not in {
                            "available",
                            "partial",
                            "full",
                            "closed",
                            "min_stay",
                            "error",
                        }:
                            status, beds_free, detail = (
                                "error",
                                None,
                                f"Unsupported checker status: {status}"[:500],
                            )
                        session.add(
                            AvailabilityCheck(
                                job_id=job_id,
                                hut_id=hut_snapshot.id,
                                night=night,
                                people=people,
                                status=status,
                                beds_free=beds_free if isinstance(beds_free, int) else None,
                                detail=str(detail or "")[:1000],
                            )
                        )
                    session.commit()

            with factory() as session:
                job = session.get(CheckJob, job_id)
                if job:
                    job.huts_done += 1
                    session.commit()

        with factory() as session:
            job = session.get(CheckJob, job_id)
            if job:
                job.status = "done"
                job.finished_at = datetime.now(timezone.utc)
                session.commit()
    except Exception as exc:
        logger.exception("Availability job %s failed", job_id)
        with factory() as session:
            job = session.get(CheckJob, job_id)
            if job:
                job.status = "failed"
                job.error = str(exc)[:1000]
                job.finished_at = datetime.now(timezone.utc)
                if job.requested_by == "admin":
                    job.airtable_status = "not_applicable"
                session.commit()
    if requested_by == "admin":
        try:
            _sync_job_to_airtable(job_id)
        except Exception:
            logger.warning("Airtable sync did not complete for check job %s.", job_id)
    if sweep_run_id is not None:
        from hut_availability.sweep import finalize_sweep_if_ready

        finalize_sweep_if_ready(sweep_run_id)


def _sync_job_to_airtable(job_id: int) -> int | None:
    factory = get_session_factory()
    with factory() as session:
        claimed = session.execute(
            update(CheckJob)
            .where(
                CheckJob.id == job_id,
                CheckJob.status == "done",
                CheckJob.airtable_status == "pending",
            )
            .values(airtable_status="syncing", airtable_error=None)
            .returning(
                CheckJob.date_from,
                CheckJob.date_to,
                CheckJob.people,
                CheckJob.hut_keys,
            )
        ).first()
        if not claimed:
            return
        date_from, date_to, people, huts = claimed
        session.commit()
    try:
        records = sync_latest(date_from, date_to, people, list(huts))
    except HTTPError as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status == 404:
            message = "Airtable could not find the configured base or table."
        elif status in {401, 403}:
            message = "Airtable rejected the PAT or it lacks write access."
        else:
            message = "Airtable sync failed. Check the configured Airtable connection."
        logger.warning("Airtable sync failed for job %s with HTTP status %s.", job_id, status)
    except Exception as exc:
        message = (
            str(exc)[:500]
            if isinstance(exc, RuntimeError)
            else "Airtable sync failed. Check the configured Airtable connection."
        )
        logger.warning("Airtable sync failed for job %s with %s.", job_id, type(exc).__name__)
    else:
        with factory() as session:
            job = session.get(CheckJob, job_id)
            if job:
                job.airtable_status = "done"
                job.airtable_error = None
                session.commit()
        return records
    with factory() as session:
        job = session.get(CheckJob, job_id)
        if job:
            job.airtable_status = "failed"
            job.airtable_error = message
            session.commit()
    raise RuntimeError(message)


def retry_job_airtable_sync(job_id: int) -> int | None:
    factory = get_session_factory()
    with factory() as session:
        claimed = session.execute(
            update(CheckJob)
            .where(
                CheckJob.id == job_id,
                CheckJob.status == "done",
                CheckJob.airtable_status.in_(("pending", "failed")),
            )
            .values(airtable_status="syncing", airtable_error=None)
            .returning(
                CheckJob.date_from,
                CheckJob.date_to,
                CheckJob.people,
                CheckJob.hut_keys,
            )
        ).first()
        if not claimed:
            return None
        session.commit()
    date_from, date_to, people, huts = claimed
    try:
        records = sync_latest(date_from, date_to, people, list(huts))
    except HTTPError as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status == 404:
            message = "Airtable could not find the configured base or table."
        elif status in {401, 403}:
            message = "Airtable rejected the PAT or it lacks write access."
        else:
            message = "Airtable sync failed. Check the configured Airtable connection."
    except Exception as exc:
        message = (
            str(exc)[:500]
            if isinstance(exc, RuntimeError)
            else "Airtable sync failed. Check the configured Airtable connection."
        )
    else:
        with factory() as session:
            job = session.get(CheckJob, job_id)
            if job:
                job.airtable_status = "done"
                job.airtable_error = None
                session.commit()
        return records
    with factory() as session:
        job = session.get(CheckJob, job_id)
        if job:
            job.airtable_status = "failed"
            job.airtable_error = message
            session.commit()
    raise RuntimeError(message)


def sync_pending_airtable() -> None:
    factory = get_session_factory()
    with factory() as session:
        pending_ids = list(
            session.scalars(
                select(CheckJob.id)
                .where(
                    CheckJob.status == "done",
                    CheckJob.requested_by == "admin",
                    CheckJob.airtable_status == "pending",
                )
                .order_by(CheckJob.created_at, CheckJob.id)
                .limit(5)
            )
        )
        session.commit()
    for job_id in pending_ids:
        try:
            _sync_job_to_airtable(job_id)
        except Exception:
            logger.warning("Pending Airtable retry failed for job %s.", job_id)


def restore_pending_airtable_syncs() -> None:
    """Release interrupted syncs after a service restart, without re-scraping."""
    factory = get_session_factory()
    with factory() as session:
        session.execute(
            update(CheckJob)
            .where(
                CheckJob.status == "done",
                CheckJob.requested_by == "admin",
                CheckJob.airtable_status == "syncing",
            )
            .values(airtable_status="pending")
        )
        session.commit()


def _days(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


async def worker(queue: asyncio.Queue[int]) -> None:
    while True:
        job_id = await queue.get()
        try:
            await asyncio.to_thread(run_job, job_id)
        except Exception:
            logger.exception("Unexpected worker error for job %s", job_id)
        finally:
            queue.task_done()


def restore_queued_jobs(queue: asyncio.Queue[int]) -> None:
    with get_session_factory()() as session:
        interrupted = session.scalars(
            select(CheckJob).where(CheckJob.status == "running")
        ).all()
        for job in interrupted:
            job.status = "queued"
            job.started_at = None
            job.error = "Service restarted while this job was running; it has been queued again."
        queued_ids = list(
            session.scalars(
                select(CheckJob.id)
                .where(CheckJob.status == "queued")
                .order_by(CheckJob.created_at, CheckJob.id)
            )
        )
        session.commit()
    for job_id in queued_ids:
        queue.put_nowait(job_id)
