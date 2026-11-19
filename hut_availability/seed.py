from __future__ import annotations

import csv
import json
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert

from hut_availability.db import get_session_factory
from hut_availability.models import Hut

SEED_FILE = Path(__file__).with_name("huts_seed.csv")


def seed_huts() -> int:
    rows = []
    with SEED_FILE.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            rows.append(
                {
                    "key": row["key"].strip(),
                    "name": row["name"].strip(),
                    "cluster": row["cluster"].strip(),
                    "system": row["system"].strip(),
                    "config": json.loads(row["config"] or "{}"),
                    "active": row["active"].strip().lower() == "true",
                    "booking_url": row["booking_url"].strip() or None,
                    "notes": row["notes"].strip() or None,
                }
            )
    if not rows:
        raise RuntimeError(f"No hut rows found in {SEED_FILE}.")

    statement = insert(Hut).values(rows)
    statement = statement.on_conflict_do_update(
        index_elements=[Hut.key],
        set_={
            "name": statement.excluded.name,
            "cluster": statement.excluded.cluster,
            "system": statement.excluded.system,
            "config": statement.excluded.config,
            "active": statement.excluded.active,
            "booking_url": statement.excluded.booking_url,
            "notes": statement.excluded.notes,
        },
    )
    with get_session_factory()() as session:
        session.execute(statement)
        session.commit()
    return len(rows)


if __name__ == "__main__":
    print(f"Loaded or updated {seed_huts()} huts.")
