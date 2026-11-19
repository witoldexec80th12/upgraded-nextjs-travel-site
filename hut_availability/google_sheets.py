from __future__ import annotations

import hashlib
import json
import subprocess
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import quote, urlencode

from hut_availability.db import get_session_factory
from hut_availability.models import (
    AvailabilityCheck,
    CheckJob,
    Hut,
    SweepRun,
    SweepSettings,
)
from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
PROXY_SCRIPT = ROOT / "scripts" / "google-sheets-proxy.mjs"


def sheets_request(method: str, path: str, body: dict | None = None) -> dict:
    request = json.dumps({"method": method, "path": path, "body": body})
    try:
        result = subprocess.run(
            ["node", str(PROXY_SCRIPT)],
            input=request,
            capture_output=True,
            text=True,
            timeout=45,
            check=False,
            cwd=ROOT,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise RuntimeError(
            "Google Sheets connector could not be reached from the Python service."
        ) from exc

    try:
        response = json.loads(result.stdout.strip().splitlines()[-1])
    except (IndexError, json.JSONDecodeError) as exc:
        raise RuntimeError("Google Sheets connector returned an invalid response.") from exc
    status = response.get("status", 0)
    if result.returncode or not 200 <= status < 300:
        message = response.get("body", {}).get("error", {}).get("message")
        if status == 403:
            raise RuntimeError(
                "Google Sheets denied access. Reconnect the integration and check its write permission."
            )
        if status == 429:
            raise RuntimeError("Google Sheets is rate-limiting writes; retry the export shortly.")
        if message and status:
            raise RuntimeError(f"Google Sheets request failed (HTTP {status}): {str(message)[:200]}")
        raise RuntimeError(response.get("error") or f"Google Sheets request failed (HTTP {status}).")
    return response.get("body") or {}


def _quote_sheet(title: str) -> str:
    return "'" + title.replace("'", "''") + "'"


def _sheet_title(hut: Hut) -> str:
    name = "".join("_" if char in "[]:*?/\\\\" else char for char in hut.name).strip()
    key = "".join("_" if char in "[]:*?/\\\\" else char for char in hut.key).strip()
    suffix = hashlib.sha1(hut.key.encode("utf-8")).hexdigest()[:8]
    return f"{name[:30]} - {key[:54]}-{suffix}"[:100]


def _nights(start: date, end: date) -> list[str]:
    return [
        (start + timedelta(days=index)).isoformat()
        for index in range((end - start).days + 1)
    ]


def _column_name(index: int) -> str:
    """Convert a zero-based column index to Google Sheets A1 notation."""
    value = index + 1
    result = ""
    while value:
        value, remainder = divmod(value - 1, 26)
        result = chr(65 + remainder) + result
    return result


def _spreadsheet_metadata(spreadsheet_id: str) -> dict:
    fields = "sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))"
    path = f"/v4/spreadsheets/{quote(spreadsheet_id, safe='')}?{urlencode({'fields': fields})}"
    return sheets_request("GET", path)


def create_availability_spreadsheet(
    huts: list[Hut], date_from: date, date_to: date, timezone: str = "Europe/Madrid"
) -> dict:
    nights = _nights(date_from, date_to)
    titles = [_sheet_title(hut) for hut in huts]
    sheets = [
        {
            "properties": {
                "sheetId": 0,
                "title": "Overview",
                "gridProperties": {"rowCount": 100, "columnCount": 8, "frozenRowCount": 1},
            }
        }
    ]
    sheets.extend(
        {
            "properties": {
                "sheetId": index,
                "title": title,
                "gridProperties": {
                    "rowCount": len(nights) + 50,
                    "columnCount": 30,
                    "frozenRowCount": 1,
                    "frozenColumnCount": 1,
                    "hideGridlines": True,
                },
            }
        }
        for index, title in enumerate(titles, start=1)
    )
    workbook = sheets_request(
        "POST",
        "/v4/spreadsheets",
        {
            "properties": {
                "title": "Alta Via Hut Availability",
                "timeZone": timezone,
                "locale": "en_GB",
            },
            "sheets": sheets,
        },
    )
    spreadsheet_id = workbook.get("spreadsheetId")
    if not spreadsheet_id:
        raise RuntimeError("Google Sheets created a workbook without returning its ID.")
    return {
        "spreadsheet_id": spreadsheet_id,
        "spreadsheet_url": workbook.get("spreadsheetUrl")
        or f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit",
    }


def initialize_existing_spreadsheet(
    spreadsheet_id: str, huts: list[Hut], date_from: date, date_to: date
) -> None:
    nights = _nights(date_from, date_to)
    properties = ensure_hut_sheets(spreadsheet_id, huts, nights)
    ranges = [f"{_quote_sheet(_sheet_title(hut))}!A:A" for hut in huts]
    current_values = _batch_get(spreadsheet_id, ranges) if ranges else []
    values_by_range = dict(
        zip(ranges, (item.get("values", []) for item in current_values))
    )
    writes = [
        {
            "range": "'Overview'!A1:B4",
            "values": [
                ["Alta Via Hut Availability", "Daily availability matrix"],
                ["MVP search: two adults, no children, one-night stays. Each row is an arrival date.", ""],
                ["AVAILABLE means the group fits, possibly across rooms; FULL is for this search; CLOSED is not necessarily sold out.", ""],
                ["Cells show status and group size, not a bed total. ERROR is unknown; manual-only huts are not scraped.", ""],
            ],
        }
    ]
    property_updates = []
    for hut in huts:
        title = _sheet_title(hut)
        sheet = properties[title]
        current_column = values_by_range.get(f"{_quote_sheet(title)}!A:A", [])
        existing_nights = [
            str(row[0])
            for row in current_column[1:]
            if row and row[0] not in (None, "")
        ]
        existing_set = set(existing_nights)
        all_nights = existing_nights + [
            night for night in nights if night not in existing_set
        ]
        if int(sheet.get("gridProperties", {}).get("rowCount", 0)) < len(all_nights) + 1:
            property_updates.append(
                {
                    "updateSheetProperties": {
                        "properties": {
                            "sheetId": sheet["sheetId"],
                            "gridProperties": {"rowCount": len(all_nights) + 50},
                        },
                        "fields": "gridProperties.rowCount",
                    }
                }
            )
        writes.append(
            {
                "range": f"{_quote_sheet(title)}!A1:A{len(all_nights) + 1}",
                "values": [["Night"], *[[night] for night in all_nights]],
            }
        )
    if property_updates:
        sheets_request(
            "POST",
            f"/v4/spreadsheets/{quote(spreadsheet_id, safe='')}:batchUpdate",
            {"requests": property_updates},
        )
    if writes:
        sheets_request(
            "POST",
            f"/v4/spreadsheets/{quote(spreadsheet_id, safe='')}/values:batchUpdate",
            {"valueInputOption": "RAW", "data": writes},
        )


def ensure_hut_sheets(spreadsheet_id: str, huts: list[Hut], nights: list[str]) -> dict:
    metadata = _spreadsheet_metadata(spreadsheet_id)
    properties = [sheet["properties"] for sheet in metadata.get("sheets", [])]
    by_title = {item["title"]: item for item in properties}
    missing = [hut for hut in huts if _sheet_title(hut) not in by_title]
    requests = []
    next_id = max((int(item["sheetId"]) for item in properties), default=0) + 1
    for offset, hut in enumerate(missing):
        title = _sheet_title(hut)
        requests.append(
            {
                "addSheet": {
                    "properties": {
                        "sheetId": next_id + offset,
                        "title": title,
                        "gridProperties": {
                            "rowCount": len(nights) + 50,
                            "columnCount": 30,
                            "frozenRowCount": 1,
                            "frozenColumnCount": 1,
                            "hideGridlines": True,
                        },
                    }
                }
            }
        )
    if requests:
        sheets_request(
            "POST",
            f"/v4/spreadsheets/{quote(spreadsheet_id, safe='')}:batchUpdate",
            {"requests": requests},
        )
        metadata = _spreadsheet_metadata(spreadsheet_id)
        properties = [sheet["properties"] for sheet in metadata.get("sheets", [])]
        by_title = {item["title"]: item for item in properties}
    return by_title


def _batch_get(spreadsheet_id: str, ranges: list[str]) -> list[dict]:
    query = urlencode([("ranges", value) for value in ranges])
    path = f"/v4/spreadsheets/{quote(spreadsheet_id, safe='')}/values:batchGet?{query}"
    return sheets_request("GET", path).get("valueRanges", [])


def _sweep_cell_text(status: str, people: int, detail: str | None = None) -> str:
    if status == "error":
        return f"Error — {(detail or 'check failed')[:180]}"
    return f"{status.replace('_', ' ')} · {people} people"


def sync_sweep_run(run_id: int) -> None:
    factory = get_session_factory()
    with factory() as session:
        run = session.get(SweepRun, run_id)
        if not run:
            raise RuntimeError("Daily sweep was not found.")
        settings = session.get(SweepSettings, 1)
        spreadsheet_id = settings.spreadsheet_id if settings else None
        if not spreadsheet_id:
            raise RuntimeError("Create the Google Sheets workbook in admin settings first.")
        huts = list(
            session.scalars(
                select(Hut).where(Hut.active.is_(True)).order_by(Hut.cluster, Hut.name)
            )
        )
        rows = session.execute(
            select(
                Hut.key,
                AvailabilityCheck.night,
                AvailabilityCheck.status,
                AvailabilityCheck.beds_free,
                AvailabilityCheck.detail,
            )
            .join(AvailabilityCheck, AvailabilityCheck.hut_id == Hut.id)
            .join(CheckJob, CheckJob.id == AvailabilityCheck.job_id)
            .where(CheckJob.sweep_run_id == run_id)
            .order_by(AvailabilityCheck.id)
        ).all()
        date_from, date_to, run_date, people = (
            run.date_from,
            run.date_to,
            run.run_date,
            run.people,
        )

    night_strings = _nights(date_from, date_to)
    result_by_hut_night = {
        (key, night.isoformat()): (status, beds, detail)
        for key, night, status, beds, detail in rows
    }
    properties = ensure_hut_sheets(spreadsheet_id, huts, night_strings)
    range_requests = []
    for hut in huts:
        title = _sheet_title(hut)
        escaped = _quote_sheet(title)
        range_requests.extend([f"{escaped}!A:A", f"{escaped}!1:1"])
    existing_values = _batch_get(spreadsheet_id, range_requests) if range_requests else []
    value_by_range = dict(
        zip(range_requests, (item.get("values", []) for item in existing_values))
    )

    write_data = []
    property_updates = []
    for hut in huts:
        title = _sheet_title(hut)
        escaped = _quote_sheet(title)
        current_column = value_by_range.get(f"{escaped}!A:A", [])
        existing_nights = [
            str(row[0])
            for row in current_column[1:]
            if row and row[0] not in (None, "")
        ]
        existing_set = set(existing_nights)
        all_nights = existing_nights + [
            night for night in night_strings if night not in existing_set
        ]
        header_rows = value_by_range.get(f"{escaped}!1:1", [])
        headers = header_rows[0] if header_rows else ["Night"]
        header_text = [str(value) for value in headers]
        try:
            column_index = header_text.index(run_date.isoformat())
        except ValueError:
            column_index = max(1, len(header_text))
        needed_columns = column_index + 1
        sheet_properties = properties[title]
        grid = sheet_properties.get("gridProperties", {})
        if len(all_nights) + 1 > int(grid.get("rowCount", 0)):
            property_updates.append(
                {
                    "updateSheetProperties": {
                        "properties": {
                            "sheetId": sheet_properties["sheetId"],
                            "gridProperties": {"rowCount": len(all_nights) + 50},
                        },
                        "fields": "gridProperties.rowCount",
                    }
                }
            )
        if needed_columns + 1 > int(grid.get("columnCount", 0)):
            property_updates.append(
                {
                    "updateSheetProperties": {
                        "properties": {
                            "sheetId": sheet_properties["sheetId"],
                            "gridProperties": {"columnCount": needed_columns + 10},
                        },
                        "fields": "gridProperties.columnCount",
                    }
                }
            )
        night_rows = {night: index + 2 for index, night in enumerate(all_nights)}
        output = []
        for night in all_nights:
            if night not in night_strings:
                output.append([""])
                continue
            if hut.system == "manual":
                output.append(["Manual only — not scanned"])
                continue
            result = result_by_hut_night.get((hut.key, night))
            if not result:
                output.append(["No result recorded"])
                continue
            status, _beds, detail = result
            output.append([_sweep_cell_text(status, people, detail)])
        sheet_column = _column_name(column_index)
        write_data.extend(
            [
                {
                    "range": f"{escaped}!A1:A{len(all_nights) + 1}",
                    "values": [["Night"], *[[night] for night in all_nights]],
                },
                {
                    "range": f"{escaped}!{sheet_column}1:{sheet_column}{len(all_nights) + 1}",
                    "values": [[run_date.isoformat()], *output],
                },
            ]
        )
    if property_updates:
        sheets_request(
            "POST",
            f"/v4/spreadsheets/{quote(spreadsheet_id, safe='')}:batchUpdate",
            {"requests": property_updates},
        )
    if write_data:
        sheets_request(
            "POST",
            f"/v4/spreadsheets/{quote(spreadsheet_id, safe='')}/values:batchUpdate",
            {"valueInputOption": "RAW", "data": write_data},
        )
