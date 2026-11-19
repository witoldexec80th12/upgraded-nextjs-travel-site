from __future__ import annotations

import os
import unittest
from contextlib import nullcontext
from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch

from hut_availability.airtable_sync import sync_latest


class AirtableSyncTests(unittest.TestCase):
    @patch.dict(
        os.environ,
        {
            "AIRTABLE_API_KEY": "test-pat",
            "AIRTABLE_BASE_ID": "app-test",
            "AIRTABLE_TABLE": "AV1 Availability",
            "AIRTABLE_TOKEN": "",
        },
    )
    @patch("hut_availability.airtable_sync.time.sleep")
    @patch("hut_availability.airtable_sync.Api")
    @patch("hut_availability.airtable_sync.get_session_factory")
    def test_uses_api_key_alias_and_upserts_in_batches(
        self, mocked_factory, mocked_api, _mocked_sleep
    ):
        rows = [
            {
                "key": f"hut-{index}",
                "name": f"Hut {index}",
                "cluster": "A",
                "booking_url": None,
                "night": date(2027, 7, 1),
                "people": 2,
                "status": "available",
                "beds_free": 2,
                "detail": "available",
                "checked_at": datetime(2026, 11, 8, tzinfo=timezone.utc),
            }
            for index in range(11)
        ]
        session = MagicMock()
        session.execute.return_value.mappings.return_value.all.return_value = rows
        mocked_factory.return_value.return_value = nullcontext(session)
        table = mocked_api.return_value.table.return_value

        count = sync_latest(date(2027, 7, 1), date(2027, 7, 1), 2)

        self.assertEqual(count, 11)
        mocked_api.assert_called_once_with("test-pat")
        mocked_api.return_value.table.assert_called_once_with("app-test", "AV1 Availability")
        self.assertEqual(table.batch_upsert.call_count, 2)
        first_batch = table.batch_upsert.call_args_list[0].args[0]
        self.assertEqual(first_batch[0]["fields"]["Key"], "hut-0|2027-07-01|2")
        self.assertEqual(
            first_batch[0]["fields"]["Checked at"],
            "2026-11-08T00:00:00.000Z",
        )
        self.assertEqual(table.batch_upsert.call_args.kwargs["key_fields"], ["Key"])

    @patch.dict(
        os.environ,
        {
            "AIRTABLE_API_KEY": "",
            "AIRTABLE_TOKEN": "",
            "AIRTABLE_BASE_ID": "app-test",
        },
    )
    def test_fails_clearly_when_token_is_missing(self):
        with self.assertRaisesRegex(RuntimeError, "AIRTABLE_API_KEY"):
            sync_latest(date(2027, 7, 1), date(2027, 7, 1), 2)


if __name__ == "__main__":
    unittest.main()
