from __future__ import annotations

import unittest
from datetime import date

from pydantic import ValidationError

from hut_availability.sweep_routes import SweepPilotRequest


class SweepPilotRequestTests(unittest.TestCase):
    def test_accepts_seven_inclusive_stay_dates(self):
        request = SweepPilotRequest(
            date_from=date(2027, 9, 15),
            date_to=date(2027, 9, 21),
            people=2,
        )
        self.assertEqual((request.date_to - request.date_from).days + 1, 7)
        self.assertEqual(request.people, 2)

    def test_rejects_more_than_seven_stay_dates(self):
        with self.assertRaises(ValidationError):
            SweepPilotRequest(
                date_from=date(2027, 9, 15),
                date_to=date(2027, 9, 22),
                people=2,
            )

    def test_rejects_reversed_date_range(self):
        with self.assertRaises(ValidationError):
            SweepPilotRequest(
                date_from=date(2027, 9, 21),
                date_to=date(2027, 9, 15),
                people=2,
            )


if __name__ == "__main__":
    unittest.main()
