from __future__ import annotations

import csv
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import Mock, patch

from hut_availability.checkers.bukly import check_bukly
from hut_availability.checkers.dibona_app import check_dibona_app
from hut_availability.checkers.foundation import classify, foundation_search, nights
from hut_availability.checkers.suedtirol import check_suedtirol
from hut_availability.runner import contiguous_ranges
from hut_availability.sweep import split_date_range
from hut_availability.google_sheets import _column_name, _sheet_title


class AvailabilityHelpersTests(unittest.TestCase):
    def test_nights_are_inclusive(self):
        self.assertEqual(
            list(nights(date(2027, 7, 1), date(2027, 7, 3))),
            [date(2027, 7, 1), date(2027, 7, 2), date(2027, 7, 3)],
        )

    def test_contiguous_ranges_only_group_adjacent_days(self):
        self.assertEqual(
            contiguous_ranges(
                [
                    date(2027, 7, 1),
                    date(2027, 7, 2),
                    date(2027, 7, 5),
                ]
            ),
            [
                (date(2027, 7, 1), date(2027, 7, 2)),
                (date(2027, 7, 5), date(2027, 7, 5)),
            ],
        )

    def test_daily_sweep_batches_never_exceed_worker_limit(self):
        batches = list(
            split_date_range(date(2026, 6, 1), date(2027, 10, 31))
        )
        self.assertEqual(batches[0], (date(2026, 6, 1), date(2026, 8, 1)))
        self.assertEqual(batches[-1][1], date(2027, 10, 31))
        self.assertTrue(all((end - start).days < 62 for start, end in batches))
        self.assertEqual(
            sum((end - start).days + 1 for start, end in batches),
            (date(2027, 10, 31) - date(2026, 6, 1)).days + 1,
        )

    def test_google_sheet_column_names_and_hut_titles_are_stable(self):
        self.assertEqual(
            [_column_name(index) for index in (0, 25, 26, 701)],
            ["A", "Z", "AA", "ZZ"],
        )
        hut = type("HutStub", (), {"key": "rifugio/alta", "name": "Rifugio [Alta] / 1"})()
        title = _sheet_title(hut)
        self.assertIn("Rifugio _Alta_ _ 1", title)
        self.assertIn("rifugio_alta", title)
        self.assertLessEqual(len(title), 100)
        self.assertEqual(title, _sheet_title(hut))

    def test_classify_group_capacity(self):
        self.assertEqual(classify(4, 4), "available")
        self.assertEqual(classify(2, 4), "partial")
        self.assertEqual(classify(0, 4), "full")

    def test_seed_file_has_active_and_manual_huts(self):
        seed_path = Path(__file__).parents[1] / "hut_availability" / "huts_seed.csv"
        with seed_path.open(encoding="utf-8", newline="") as handle:
            rows = list(csv.DictReader(handle))
        self.assertEqual(len(rows), 26)
        self.assertTrue(any(row["system"] == "manual" for row in rows))
        self.assertTrue(any(row["system"] == "dibona_app" for row in rows))


class CheckerTests(unittest.TestCase):
    @patch("hut_availability.checkers.foundation.http")
    def test_foundation_search_counts_bookable_beds(self, mocked_http):
        mocked_http.return_value = Mock(
            text=(
                "<p>4-bed dorm</p>"
                '<select name="beds"><option value="0">0</option><option value="3">3</option></select>'
            )
        )
        beds, detail = foundation_search({"search": "https://example.test/search"}, date(2027, 7, 1), 4)
        self.assertEqual(beds, 3)
        self.assertIn(":3", detail)

    @patch("hut_availability.checkers.bukly.http")
    def test_bukly_offer_reports_partial_capacity(self, mocked_http):
        mocked_http.return_value = Mock(
            text=(
                '<div class="hotel-room__sub">'
                '<div class="hotel-room__sub-title">Dormitory</div>'
                '<div>Nr. beds</div>'
                '<select name="data[Room][1]"><option value="0">0</option><option value="2">2</option></select>'
                "</div>"
            )
        )
        rows = check_bukly(
            "scotoni",
            {"sub": "scotoni"},
            date(2027, 7, 1),
            date(2027, 7, 1),
            4,
        )
        self.assertEqual(rows[0][1:3], ("partial", 2))

    @patch("hut_availability.checkers.suedtirol.http")
    def test_suedtirol_arrival_requires_next_day_departure(self, mocked_http):
        response = Mock()
        response.json.return_value = [
            {
                "date": "2027-07-01",
                "departures": [
                    {"departure": "2027-07-02", "rule": "departure_possible"}
                ],
            }
        ]
        mocked_http.return_value = response
        rows = check_suedtirol(
            "fanes",
            {"property": 13308},
            date(2027, 7, 1),
            date(2027, 7, 1),
            2,
        )
        self.assertEqual(rows[0][1], "available")
        self.assertEqual(mocked_http.call_count, 2)

    @patch("hut_availability.checkers.dibona_app.http")
    def test_dibona_blocked_days_are_closed(self, mocked_http):
        response = Mock()
        response.json.return_value = {"available": False, "reason": "BLOCKED_DAYS"}
        mocked_http.return_value = response
        rows = check_dibona_app(
            "dibona",
            {"url": "https://example.test/api/search"},
            date(2027, 7, 1),
            date(2027, 7, 1),
            2,
        )
        self.assertEqual(rows[0][1:], ("closed", 0, "BLOCKED_DAYS"))


if __name__ == "__main__":
    unittest.main()
