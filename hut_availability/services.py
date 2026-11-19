from __future__ import annotations

from datetime import date

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from hut_availability.models import CheckJob, Hut

MAX_NIGHTS = 62
MAX_PEOPLE = 12


def validate_search(date_from: date, date_to: date, people: int) -> None:
    nights = (date_to - date_from).days + 1
    if nights < 1:
        raise HTTPException(status_code=422, detail="date_to must be on or after date_from.")
    if nights > MAX_NIGHTS:
        raise HTTPException(status_code=422, detail="A check can cover at most 62 nights.")
    if not 1 <= people <= MAX_PEOPLE:
        raise HTTPException(status_code=422, detail="people must be between 1 and 12.")


def choose_huts(
    session: Session,
    hut_keys: list[str] | None = None,
    clusters: list[str] | None = None,
) -> list[Hut]:
    all_huts = list(session.scalars(select(Hut).order_by(Hut.cluster, Hut.name)))
    if hut_keys:
        known = {hut.key for hut in all_huts}
        missing = sorted(set(hut_keys) - known)
        if missing:
            raise HTTPException(status_code=422, detail=f"Unknown hut key(s): {', '.join(missing)}.")
    if clusters:
        known_clusters = {hut.cluster for hut in all_huts}
        missing_clusters = sorted(set(clusters) - known_clusters)
        if missing_clusters:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown cluster(s): {', '.join(missing_clusters)}.",
            )

    if hut_keys and clusters:
        selected = [hut for hut in all_huts if hut.key in hut_keys or hut.cluster in clusters]
    elif hut_keys:
        selected = [hut for hut in all_huts if hut.key in hut_keys]
    elif clusters:
        selected = [hut for hut in all_huts if hut.cluster in clusters]
    else:
        selected = all_huts
    return [hut for hut in selected if hut.active]


def create_check_job(
    session: Session,
    *,
    date_from: date,
    date_to: date,
    people: int,
    huts: list[Hut],
    requested_by: str,
    force: bool = False,
) -> CheckJob:
    if not huts:
        raise HTTPException(status_code=422, detail="Select at least one active hut.")
    job = CheckJob(
        requested_by=requested_by,
        date_from=date_from,
        date_to=date_to,
        people=people,
        hut_keys=[hut.key for hut in huts],
        force=force,
        status="queued",
        huts_total=sum(1 for hut in huts if hut.system != "manual"),
        huts_done=0,
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return job
