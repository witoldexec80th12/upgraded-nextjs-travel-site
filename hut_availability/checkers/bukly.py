from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta

import requests
from bs4 import BeautifulSoup

from hut_availability.checkers.base import http
from hut_availability.checkers.foundation import classify, nights
from hut_availability.checkers.bukly_v2 import (
    MAX_LAYOUTS, BuklyResponseError, blocked, calendar, detail, fit, layouts,
    page_payload, validate_search,
)


def bukly_beds_in_name(name):
    match = re.search(r"(\d+)\s*(?:beds|letti|bett|posti)", name, re.I)
    if match:
        return int(match.group(1))
    for pattern, count in (
        (r"\b(single|singola|einzel)\b", 1),
        (r"\b(double|twin|doppia|matrimoniale|doppel)\b", 2),
        (r"\b(triple|tripla)\b", 3), (r"\b(quadruple|quadrupla)\b", 4),
    ):
        if re.search(pattern, name, re.I):
            return count
    return None  # Never silently assume a private room contains one bed.


def legacy_result(text, night, people, cfg):
    soup = BeautifulSoup(text, "html.parser")
    offers = soup.select(".hotel-room__sub")
    units = {}
    for offer in offers:
        title_node = offer.select_one(".hotel-room__sub-title")
        title = title_node.get_text(" ", strip=True) if title_node else ""
        select = offer.select_one('select[name^="data[Room]"]')
        if not title or select is None:
            raise BuklyResponseError("Bukly legacy offer is incomplete")
        values = [int(o["value"]) for o in select.select("option[value]") if o["value"].isdigit()]
        if not values:
            raise BuklyResponseError("Bukly legacy quantity is missing")
        label = re.search(r"Nr\.\s*(beds|rooms|letti|camere|betten|zimmer)\b", offer.get_text(" ", strip=True), re.I)
        if not label:
            raise BuklyResponseError("Bukly legacy unit is unknown")
        kind = "bed" if label[1].lower() in {"beds", "letti", "betten"} else "room"
        identity = re.sub(r"\b(half board|full board|b&b|bed.?breakfast|mezza pensione|pensione completa)\b", "", title, flags=re.I)
        identity = re.sub(r"\W+", " ", identity).strip().lower()
        mapping = cfg.get("room_types", {}).get(identity, {})
        capacity = 1 if kind == "bed" else mapping.get("beds_per_unit", bukly_beds_in_name(title))
        if type(capacity) is not int or capacity < 1:
            raise BuklyResponseError("Configure beds_per_unit for this Bukly private-room type")
        key = (identity, kind)
        quantity = max(values)
        previous = units.get(key)
        if previous and previous["beds_per_unit"] != capacity:
            raise BuklyResponseError("Bukly legacy room capacity is inconsistent")
        units[key] = {"room_type": identity, "unit": kind, "beds_per_unit": capacity,
                      "units_free": max(quantity, previous["units_free"] if previous else 0)}
    if units:
        beds = sum(u["units_free"] * u["beds_per_unit"] for u in units.values())
        return classify(beds, people), beds, json.dumps({
            "engine_version": "bukly_v1", "count_type": "estimate", "units": list(units.values()),
        })
    # Only explicit, fully parsed grid cells can prove a legacy night has no offers.
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        headers = rows[0].find_all(["td", "th"])[1:]
        for index, header in enumerate(headers):
            match = re.fullmatch(r"([A-Za-z]{3})\s+(\d{1,2})", header.get_text(" ", strip=True))
            if not match:
                continue
            try:
                day = datetime.strptime(f"{match[1]} {match[2]} {night.year}", "%b %d %Y").date()
            except ValueError:
                continue
            if day != night:
                continue
            cells = [row.find_all("td")[1:] for row in rows[1:]]
            if not cells or any(len(row) <= index for row in cells):
                raise BuklyResponseError("Bukly legacy calendar is incomplete")
            markers = [row[index].select_one("div") for row in cells]
            if all(marker is not None and "s-closed" in marker.get("class", []) for marker in markers):
                return "full", 0, json.dumps({"engine_version": "bukly_v1", "count_type": "yes_no", "reason": "all grid room types closed"})
    for tag in soup(["script", "style"]):
        tag.decompose()
    if re.fullmatch(r"(?:sold out|no rooms available|esaurito|ausgebucht)[.!]?", soup.get_text(" ", strip=True), re.I):
        return "full", 0, json.dumps({"engine_version": "bukly_v1", "count_type": "yes_no", "reason": "explicit no-offer response"})
    raise BuklyResponseError("Bukly returned an unknown page or open grid without offers; not sold out")


def check_bukly(name: str, cfg: dict, d_from: date, d_to: date, people: int):
    sub = cfg.get("sub", "")
    if not isinstance(sub, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", sub):
        raise ValueError("Invalid Bukly public subdomain")
    if type(people) is not int or not 1 <= people <= 12 or d_from > d_to:
        raise ValueError("Bukly requires 1–12 guests and an ordered date range")
    base = f"https://{sub}.bukly.com"
    options = layouts(people)
    rows, cached_calendar = [], None
    legacy = False
    for night in nights(d_from, d_to):
        departure = night + timedelta(days=1)
        if cached_calendar:
            reason = blocked(cached_calendar, night)
            if reason:
                rows.append((night, "closed", 0, detail("closed", reason=reason)))
                continue
        best, ambiguous = 0, False
        for index, layout in enumerate(options[:MAX_LAYOUTS]):
            if legacy:
                response = http("GET", f"{base}/en-us/hotel/{night}/{departure}/")
            else:
                try:
                    response = http("GET", base + "/booking", params={
                        "checkin": str(night), "checkout": str(departure),
                        "rooms": "|".join(map(str, layout)),
                    })
                except requests.HTTPError as exc:
                    if exc.response is None or exc.response.status_code != 404 or index:
                        raise
                    legacy = True
                    response = http("GET", f"{base}/en-us/hotel/{night}/{departure}/")
            if legacy or BeautifulSoup(response.text, "html.parser").select_one(".hotel-room__sub"):
                status, beds, message = legacy_result(response.text, night, people, cfg)
                rows.append((night, status, beds, message))
                break
            engine, allocations = page_payload(response.text)
            validate_search(engine, allocations, sub, night, departure, layout)
            cal = calendar(engine)
            cached_calendar = cal
            reason = blocked(cal, night)
            if reason:
                if allocations and fit(allocations)[0]:
                    raise BuklyResponseError("Bukly calendar contradicts its bookable offers")
                rows.append((night, "closed", 0, detail("closed", reason=reason)))
                break
            if departure in cal[2]["checkoutRestricted"]:
                rows.append((night, "error", None, detail("error", reason="One-night departure is restricted; minimum stay is unconfirmed")))
                break
            matched, uncertain = fit(allocations)
            ambiguous |= uncertain or bool(engine.get("combinations"))
            best = max(best, matched)
            if matched == people:
                rows.append((night, "available", None, detail(
                    "available", people=people, layout=list(layout), reason="Verified fit for this guest layout; total beds left is unknown",
                )))
                break
        else:
            if len(options) > MAX_LAYOUTS or ambiguous:
                rows.append((night, "error", None, detail("error", reason="Group fit remains unconfirmed after bounded layout searches")))
            else:
                status = "partial" if best else "full"
                rows.append((night, status, best, detail(
                    status, reason="All guest partitions checked for this one-night stay; no inference about minimum stays",
                )))
    return rows
