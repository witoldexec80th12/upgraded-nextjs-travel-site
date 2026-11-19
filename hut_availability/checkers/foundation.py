from __future__ import annotations

import re
from datetime import date, timedelta

from bs4 import BeautifulSoup

from hut_availability.checkers.base import http
from hut_availability.checkers.base import USER_AGENT  # exposed for diagnostics
from hut_availability.checkers.base import ScrapePolicyError

IT_MONTHS = {
    month: index
    for index, month in enumerate(
        [
            "gennaio",
            "febbraio",
            "marzo",
            "aprile",
            "maggio",
            "giugno",
            "luglio",
            "agosto",
            "settembre",
            "ottobre",
            "novembre",
            "dicembre",
        ],
        start=1,
    )
}
SOLD_OUT = re.compile(r"esaurit|sold out|nicht verfügbar|ausgebucht|non disponibil", re.I)


def foundation_calendar(cfg: dict, d_from: date, d_to: date) -> dict[date, bool]:
    """Read one public availability calendar per requested month."""
    result: dict[date, bool] = {}
    today = date.today()
    months = sorted({(night.year, night.month) for night in nights(d_from, d_to)})
    for year, month in months:
        offset = (year - today.year) * 12 + (month - today.month)
        soup = BeautifulSoup(
            http("GET", cfg["cal"], params={"prm": today.month, "chm": offset}).text,
            "html.parser",
        )
        table = soup.find(id="TabDisp")
        if not table:
            continue
        header = table.find("th", attrs={"colspan": True})
        if not header:
            continue
        parts = header.get_text(strip=True).lower().split()
        try:
            displayed_month, displayed_year = IT_MONTHS.get(parts[0]), int(parts[1])
        except (IndexError, ValueError):
            continue
        if displayed_month != month or displayed_year != year:
            continue
        for cell in table.find_all("td", class_=True):
            text = cell.get_text(strip=True)
            if text.isdigit():
                result[date(year, month, int(text))] = "libero" in cell["class"]
    return result


def nights(d_from: date, d_to: date):
    current = d_from
    while current <= d_to:
        yield current
        current += timedelta(days=1)


def foundation_search(cfg: dict, night: date, people: int) -> tuple[int, str]:
    """Search the site's public first booking step and count offered beds."""
    data = {
        "arrivo": night.strftime("%d/%m/%Y"),
        "partenza": (night + timedelta(days=1)).strftime("%d/%m/%Y"),
        "persone": str(people),
        **cfg.get("extra", {}),
    }
    soup = BeautifulSoup(http("POST", cfg["search"], data=data).text, "html.parser")
    text = soup.get_text(" ", strip=True)
    if SOLD_OUT.search(text) and not soup.find("select"):
        return 0, "sold out"
    beds, parts = 0, []
    for select in soup.find_all("select"):
        values = [
            int(option.get("value"))
            for option in select.find_all("option")
            if (option.get("value") or "").isdigit()
        ]
        if not values or re.search(
            r"tratt|sauna|can[ei]|dog|hund|pension|board",
            select.get("name", ""),
            re.I,
        ):
            continue
        label = select.find_previous(string=re.compile(r"\w"))
        available = max(values)
        beds += available
        parts.append(f"{(label or '').strip()[:40]}:{available}")
    return beds, "; ".join(parts)


def classify(beds: int, people: int) -> str:
    if beds >= people:
        return "available"
    return "partial" if beds > 0 else "full"


def check_foundation(
    name: str, cfg: dict, d_from: date, d_to: date, people: int
) -> list[tuple[date, str, int | None, str]]:
    rows = []
    calendar = foundation_calendar(cfg, d_from, d_to)
    for night in nights(d_from, d_to):
        if calendar and not calendar.get(night, False):
            rows.append((night, "closed", 0, "calendar: not bookable"))
            continue
        beds, detail = foundation_search(cfg, night, people)
        rows.append((night, classify(beds, people), beds, detail))
    return rows
