from __future__ import annotations

import os
import time
from datetime import date, datetime, timezone

from pyairtable import Api
from sqlalchemy import text

from hut_availability.db import get_session_factory


def _airtable_datetime(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def sync_latest(
    date_from: date,
    date_to: date,
    people: int,
    hut_keys: list[str] | None = None,
) -> int:
    token = os.getenv("AIRTABLE_API_KEY") or os.getenv("AIRTABLE_TOKEN")
    base_id = os.getenv("AIRTABLE_BASE_ID")
    table_name = os.getenv("AIRTABLE_TABLE", "AV1 Availability")
    if not token or not base_id:
        raise RuntimeError(
            "Airtable sync is not configured. Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID."
        )

    with get_session_factory()() as session:
        rows = session.execute(
            text(
                """
                SELECT h.key, h.name, h.cluster, h.booking_url,
                       a.night, a.people, a.status, a.beds_free, a.detail, a.checked_at
                FROM latest_availability AS a
                JOIN huts AS h ON h.id = a.hut_id
                WHERE a.night >= :date_from AND a.night <= :date_to
                  AND a.people = :people
                  AND (CAST(:hut_keys AS TEXT[]) IS NULL OR h.key = ANY(:hut_keys))
                ORDER BY h.cluster, h.name, a.night
                """
            ),
            {
                "date_from": date_from,
                "date_to": date_to,
                "people": people,
                "hut_keys": hut_keys,
            },
        ).mappings().all()

    records = [
        {
            "fields": {
                "Key": f"{row['key']}|{row['night'].isoformat()}|{row['people']}",
                "Hut": row["name"],
                "Cluster": row["cluster"],
                "Night": row["night"].isoformat(),
                "People": row["people"],
                "Status": row["status"],
                "Beds free": row["beds_free"],
                "Detail": row["detail"] or "",
                "Checked at": _airtable_datetime(row["checked_at"]),
                "Booking URL": row["booking_url"] or "",
            }
        }
        for row in rows
    ]
    table = Api(token).table(base_id, table_name)
    for index in range(0, len(records), 10):
        table.batch_upsert(records[index : index + 10], key_fields=["Key"])
        if index + 10 < len(records):
            time.sleep(0.25)
    return len(records)
