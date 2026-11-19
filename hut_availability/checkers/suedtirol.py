from __future__ import annotations

import json
from datetime import date, timedelta

from hut_availability.checkers.base import http
from hut_availability.checkers.foundation import nights


def suedtirol_arrivals(
    property_id: int, months: list[tuple[int, int]], guests: list[list[int]]
) -> dict[str, dict[str, str]]:
    arrivals: dict[str, dict[str, str]] = {}
    for year, month in months:
        first = date(year, month, 1)
        last = (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        response = http(
            "GET",
            f"https://api.widgets.bookingsuedtirol.com/v6/properties/{property_id}/availabilities",
            params={
                "from": first.isoformat(),
                "to": last.isoformat(),
                "guests": json.dumps(guests, separators=(",", ":")),
                "sourceId": 98,
            },
        ).json()
        if not isinstance(response, list):
            raise ValueError("Booking Südtirol returned an unexpected availability response.")
        for arrival in response:
            arrivals[arrival["date"]] = {
                departure["departure"]: departure["rule"]
                for departure in arrival.get("departures", [])
            }
    return arrivals


def check_suedtirol(
    name: str, cfg: dict, d_from: date, d_to: date, people: int
) -> list[tuple[date, str, int | None, str]]:
    months = sorted({(night.year, night.month) for night in nights(d_from, d_to)})
    layouts = {
        "one room": [[18] * people],
        "separate beds": [[18] for _ in range(people)],
    }
    results = {
        label: suedtirol_arrivals(cfg["property"], months, guests)
        for label, guests in layouts.items()
    }
    rows = []
    for night in nights(d_from, d_to):
        next_day = (night + timedelta(days=1)).isoformat()
        available, reasons = [], []
        for label, arrivals in results.items():
            departure_options = arrivals.get(night.isoformat())
            if departure_options is not None:
                rule = departure_options.get(next_day, "")
                (available if rule == "departure_possible" else reasons).append(
                    f"{label}:{rule or 'longer stay required'}"
                )
        if available:
            rows.append((night, "available", people, "; ".join(available)))
        elif reasons:
            rows.append((night, "min_stay", None, "; ".join(reasons)))
        else:
            rows.append((night, "full", 0, "no arrival possible for this group"))
    return rows
