from __future__ import annotations

import unittest
from datetime import date
from unittest.mock import patch

from hut_availability.google_sheets import (
    _sweep_cell_text,
    create_availability_spreadsheet,
)


class GoogleSheetsWriterTests(unittest.TestCase):
    def test_sweep_cells_do_not_present_provider_counts_as_exact_bed_totals(self):
        self.assertEqual(
            _sweep_cell_text("available", 2, "6 estimated beds"),
            "available · 2 people",
        )
        self.assertEqual(
            _sweep_cell_text("closed", 2),
            "closed · 2 people",
        )

    def test_sweep_errors_stay_explicit(self):
        self.assertEqual(
            _sweep_cell_text("error", 2, "Calendar response was malformed."),
            "Error — Calendar response was malformed.",
        )

    @patch("hut_availability.google_sheets.sheets_request")
    def test_create_workbook_builds_one_hut_tab_and_date_axis_without_network(self, mocked_request):
        hut = type(
            "HutStub",
            (),
            {"key": "dibona", "name": "Rifugio Dibona", "cluster": "1", "system": "manual"},
        )()
        mocked_request.return_value = {
            "spreadsheetId": "sheet-test-id",
            "spreadsheetUrl": "https://docs.google.test/spreadsheets/d/sheet-test-id/edit",
        }

        result = create_availability_spreadsheet(
            [hut], date(2026, 6, 1), date(2026, 6, 3)
        )

        self.assertEqual(result["spreadsheet_id"], "sheet-test-id")
        create_request = mocked_request.call_args_list[0]
        self.assertEqual(create_request.args[0], "POST")
        self.assertEqual(create_request.args[1], "/v4/spreadsheets")
        create_body = create_request.args[2]
        self.assertEqual(
            [sheet["properties"]["title"] for sheet in create_body["sheets"]],
            ["Overview", "Rifugio Dibona - dibona-d0d44a4a"],
        )
        mocked_request.assert_called_once()

    @patch("hut_availability.google_sheets.sheets_request")
    @patch("hut_availability.google_sheets._batch_get")
    @patch("hut_availability.google_sheets.ensure_hut_sheets")
    def test_setup_appends_dates_without_replacing_existing_hut_rows(
        self, mocked_ensure, mocked_get, mocked_request
    ):
        hut = type(
            "HutStub",
            (),
            {"key": "dibona", "name": "Rifugio Dibona", "cluster": "1", "system": "manual"},
        )()
        from hut_availability.google_sheets import _sheet_title, initialize_existing_spreadsheet

        title = _sheet_title(hut)
        mocked_ensure.return_value = {
            title: {
                "sheetId": 1,
                "gridProperties": {"rowCount": 1000, "columnCount": 30},
            }
        }
        mocked_get.return_value = [{"values": [["Night"], ["2026-06-01"]]}]

        initialize_existing_spreadsheet(
            "sheet-test-id", [hut], date(2026, 6, 1), date(2026, 6, 3)
        )

        payload = mocked_request.call_args.args[2]
        writes = payload["data"]
        self.assertEqual(writes[0]["range"], "'Overview'!A1:B4")
        self.assertEqual(
            writes[1]["values"],
            [["Night"], ["2026-06-01"], ["2026-06-02"], ["2026-06-03"]],
        )


if __name__ == "__main__":
    unittest.main()
