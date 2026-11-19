"""Read-only Inertia booking results; no cart, guest, payment, or reservation calls."""
from __future__ import annotations

import json
from collections import Counter
from datetime import date
from functools import lru_cache

from bs4 import BeautifulSoup

MAX_LAYOUTS = 6


class BuklyResponseError(ValueError):
    pass


def integer(value):
    if type(value) is not int or value < 0:
        raise BuklyResponseError("Bukly returned an invalid inventory quantity")
    return value


def page_payload(text):
    soup = BeautifulSoup(text, "html.parser")
    node = soup.select_one("[data-page]")
    if node is None:
        raise BuklyResponseError("Bukly booking JSON is missing; not a sold-out response")
    try:
        page = json.loads(node.get_text() if node.name == "script" else node["data-page"])
        props = page["props"]
        engine = props["bookingEngine"]
        if (
            page["component"] != "modules/BookingEngine/resources/js/Pages/Index"
            or not isinstance(engine, dict)
            or not isinstance(props["allocations"], list)
            or props.get("errors")
        ):
            raise BuklyResponseError("Bukly search payload is incomplete or rejected")
        return engine, props["allocations"]
    except (KeyError, TypeError, json.JSONDecodeError):
        raise BuklyResponseError("Bukly booking JSON has changed or is malformed") from None


def layouts(people):
    """Prioritize common layouts, then enumerate other integer partitions."""
    def partitions(n, limit):
        if not n:
            yield ()
        for head in range(min(n, limit), 0, -1):
            for tail in partitions(n - head, head):
                yield (head, *tail)

    preferred = [(people,), (2,) * (people // 2) + (1,) * (people % 2), (1,) * people]
    return list(dict.fromkeys([*preferred, *partitions(people, people)]))


def validate_search(engine, allocations, sub, night, departure, layout):
    try:
        form = engine["form"]
        if (
            engine["hotel"]["slug"] != sub
            or form["checkin"] != night.isoformat()
            or form["checkout"] != departure.isoformat()
            or form["rooms"] != "|".join(map(str, layout))
            or form["dateConfirmed"] is not True
        ):
            raise BuklyResponseError("Bukly did not confirm the requested hut, dates and guest layout")
        if engine.get("hotelRestrictions"):
            raise BuklyResponseError("Bukly hotel-level restrictions need confirmation")
        if engine["hotel"].get("reservation_per_request"):
            raise BuklyResponseError("Bukly offers request-only reservations, not confirmed live availability")
        if allocations:
            if len(allocations) != len(layout):
                raise BuklyResponseError("Bukly omitted a guest-layout result")
            adults = []
            for allocation in allocations:
                query = allocation["query"]
                adults.append(integer(query["adults"]))
                if query["children"] != 0 or query["childrenAges"] != []:
                    raise BuklyResponseError("Bukly returned an unexpected guest layout")
            if Counter(adults) != Counter(layout):
                raise BuklyResponseError("Bukly returned another group's results")
    except (KeyError, TypeError):
        raise BuklyResponseError("Bukly search confirmation is incomplete") from None


def calendar(engine):
    try:
        cal = engine["calendarRestrictions"]
        first, last = date.fromisoformat(cal["minDate"]), date.fromisoformat(cal["maxDate"])
        if first > last:
            raise ValueError()
        values = {}
        for field in ("unavailableDates", "checkinRestricted", "checkoutRestricted"):
            raw = cal[field]
            if not isinstance(raw, list):
                raise ValueError()
            values[field] = {date.fromisoformat(item) for item in raw}
        return first, last, values
    except (KeyError, TypeError, ValueError):
        raise BuklyResponseError("Bukly calendar/window metadata is missing or malformed") from None


def blocked(cal, night):
    first, last, flags = cal
    if night < first or night > last:
        return "outside the published booking window; not evidence of sold out"
    if night in flags["unavailableDates"] or night in flags["checkinRestricted"]:
        return "calendar marks arrival not bookable; closed/not opened/blocked cannot be distinguished"
    return None


def fit(allocations):
    """Conservative shared-inventory allocation across all requests in one layout.

    Rate plans are alternatives, not additional rooms. Every assignment consumes
    both its physical room pool and rate-plan pool. No title-based capacities.
    """
    capacities = {}
    room_units = {}
    requests = []
    ambiguous = False

    def register(key, quantity):
        quantity = integer(quantity)
        if key in capacities and capacities[key] != quantity:
            raise BuklyResponseError("Bukly returned inconsistent shared inventory")
        capacities[key] = quantity

    try:
        for allocation in allocations:
            adults = integer(allocation["query"]["adults"])
            options = []
            assignments = allocation["assignments"]
            if not isinstance(assignments, list) or not adults:
                raise BuklyResponseError("Bukly assignments are malformed")
            for assignment in assignments:
                room = assignment["room"]
                if type(room["isCompatible"]) is not bool:
                    raise BuklyResponseError("Bukly room compatibility is missing")
                rid = str(room["id"])
                if not rid or room["id"] is None:
                    raise BuklyResponseError("Bukly room identity is missing")
                room_quantity = integer(room["minAvailability"])
                plans = room["ratePlans"]
                if not isinstance(plans, list):
                    raise BuklyResponseError("Bukly rate plans are malformed")
                ambiguous |= bool(room.get("packages"))
                for plan in plans:
                    unit = plan["sell_type"]
                    if unit not in {"bed", "room"}:
                        ambiguous = True
                        continue
                    # Live Bukly displays selectable bed rates even when this
                    # room-level hint is false. For bed sales the confirmed
                    # guest quantity and available bed pool establish fit.
                    # Private-room non-matches need capacity evidence we lack.
                    if unit == "room" and not room["isCompatible"]:
                        ambiguous = True
                        continue
                    if plan.get("restrictions") not in (None, {}):
                        ambiguous = True
                        continue
                    # On the current engine a private-room quote uses
                    # total_guests=1 even for two adults: it counts a sale unit,
                    # not room capacity. isCompatible confirms guest fit.
                    quoted_units = integer(plan["total_guests"])
                    if not quoted_units or (unit == "bed" and quoted_units != adults):
                        ambiguous = True
                        continue
                    if rid in room_units and room_units[rid] != unit:
                        raise BuklyResponseError("Bukly mixes room and bed inventory in the same pool")
                    room_units[rid] = unit
                    pid = str(plan["id"])
                    if plan["id"] is None or not pid:
                        raise BuklyResponseError("Bukly rate-plan identity is missing")
                    physical, rate = ("room", rid), ("rate", rid, pid)
                    register(physical, room_quantity)
                    register(rate, integer(plan["minAvailability"]))
                    used = adults if unit == "bed" else 1
                    if min(capacities[physical], capacities[rate]) >= used:
                        options.append((physical, rate, used))
            requests.append((adults, list(dict.fromkeys(options))))
    except (KeyError, TypeError):
        raise BuklyResponseError("Bukly inventory schema is incomplete") from None

    keys = list(capacities)
    indexes = {key: i for i, key in enumerate(keys)}
    requests.sort(key=lambda item: len(item[1]))
    visits = 0

    @lru_cache(maxsize=20000)
    def search(index, remaining):
        nonlocal visits
        visits += 1
        if visits > 20000:
            raise BuklyResponseError("Bukly group-fit complexity limit reached")
        if index == len(requests):
            return 0
        adults, options = requests[index]
        upper = sum(item[0] for item in requests[index:])
        best = 0
        for physical, rate, used in options:
            pi, ri = indexes[physical], indexes[rate]
            if remaining[pi] >= used and remaining[ri] >= used:
                updated = list(remaining)
                updated[pi] -= used
                updated[ri] -= used
                best = max(best, adults + search(index + 1, tuple(updated)))
                if best == upper:
                    return best
        return max(best, search(index + 1, remaining))

    guests = sum(item[0] for item in requests)
    return search(0, tuple(min(q, guests) for q in capacities.values())), ambiguous


def detail(status, **kwargs):
    return json.dumps({
        "engine_version": "bukly_v2",
        "count_type": "yes_no" if status in {"available", "full", "closed"} else "lower_bound",
        **kwargs,
    }, ensure_ascii=False)
