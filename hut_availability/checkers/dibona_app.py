from __future__ import annotations

import json
from datetime import date, timedelta

from hut_availability.checkers.base import http
from hut_availability.checkers.foundation import nights


def check_dibona_app(
    name: str, cfg: dict, d_from: date, d_to: date, people: int
) -> list[tuple[date, str, int | None, str]]:
    rows = []
    url = cfg.get("url", "https://rifugiodibona.app/api/search")
    for night in nights(d_from, d_to):
        response = http(
            "GET",
            url,
            params={
                "checkIn": night.isoformat(),
                "checkOut": (night + timedelta(days=1)).isoformat(),
                "guests": json.dumps(
                    [{"type": "adult", "count": people}],
                    separators=(",", ":"),
                ),
            },
        ).json()
        if not isinstance(response, dict) or "available" not in response:
            raise ValueError("Dibona returned an unexpected availability response.")
        reason = str(response.get("reason") or "")
        if response["available"] is True:
            rows.append((night, "available", people, reason or "available"))
        elif reason == "BLOCKED_DAYS":
            rows.append((night, "closed", 0, "BLOCKED_DAYS"))
        else:
            rows.append((night, "full", 0, reason or "not available"))
    return rows
