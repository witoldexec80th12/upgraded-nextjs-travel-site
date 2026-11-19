import json
import io
import os
import subprocess
import sys
import tempfile
import time
import unittest
from contextlib import redirect_stderr
from datetime import date
from pathlib import Path
from unittest.mock import patch

import requests

from hut_availability.benchmark.core import ROOT, inventory, measure_case
from hut_availability.benchmark.estimates import estimate_all, request_bounds
from hut_availability.benchmark.__main__ import child_environment, main, run_child
from hut_availability.benchmark.transport import Metrics, UnsafeRequest, MalformedResponse, measured_transport, validate_response
from hut_availability.benchmark.fixtures import FixtureSite
from hut_availability.checkers import base


def spec(hut="dibona", scenario="available", **kwargs):
    return {
        "hut": hut, "start": "2027-06-28", "nights": 1, "mode": "fixture",
        "scenario": scenario, "max_requests": 30, "max_seconds": 300, **kwargs,
    }


class BenchmarkTests(unittest.TestCase):
    def setUp(self):
        # Offline tests must fail closed if any real HTTP request is attempted.
        self.network = patch.object(requests.Session, "send", side_effect=AssertionError("Live network forbidden"))
        self.network.start()
        self.addCleanup(self.network.stop)

    def test_all_systems_available_and_explicitly_empty(self):
        for hut in ("fodara", "scotoni", "lagazuoi", "dibona"):
            with self.subTest(hut=hut):
                available = measure_case(spec(hut, nights=7))
                self.assertEqual(available["outcome"], "validated_availability")
                empty = measure_case(spec(hut, "empty", nights=7))
                self.assertEqual(empty["outcome"], "validated_no_availability")
                self.assertEqual(sum(empty["status_counts"].values()), 7)

    def test_fast_failures_are_not_success(self):
        for hut in ("fodara", "scotoni", "lagazuoi", "dibona"):
            for scenario, expected in (
                ("malformed", "malformed_response"), ("denied", "access_denied"),
                ("timeout", "timeout"), ("robots_denied", "policy_denied"),
            ):
                with self.subTest(hut=hut, scenario=scenario):
                    self.assertEqual(measure_case(spec(hut, scenario))["outcome"], expected)

    def test_html_challenge_rejected(self):
        self.assertEqual(measure_case(spec("scotoni", "challenge"))["outcome"], "access_denied")

    def test_requests_pacing_retry_and_bytes_are_accounted(self):
        result = measure_case(spec(scenario="retry"))
        self.assertEqual(result["outcome"], "validated_availability")
        self.assertEqual(result["requests"], 3)  # robots, 429, successful retry
        self.assertEqual([a["status"] for a in result["attempts"]], [200, 429, 200])
        self.assertEqual(result["retry_sleeps"], 1)
        self.assertAlmostEqual(result["retry_backoff_seconds"], 30)
        self.assertGreater(result["pacing_seconds"], 1.9)
        self.assertGreater(result["response_bytes"], 0)
        self.assertGreater(result["peak_process_memory_mib"], 0)

    def test_budget_includes_robots_and_required_waits(self):
        self.assertEqual(measure_case(spec(max_requests=1))["outcome"], "budget_exceeded")
        self.assertEqual(measure_case(spec(scenario="retry", max_seconds=10))["outcome"], "budget_exceeded")
        self.assertEqual(measure_case(spec(nights=7, max_seconds=3))["outcome"], "budget_exceeded")

    def test_transport_globals_restored(self):
        original_client, original_time = base.CLIENT, base.time
        measure_case(spec(scenario="malformed"))
        self.assertIs(base.CLIENT, original_client)
        self.assertIs(base.time, original_time)

    def test_only_selected_host_and_readonly_endpoints_allowed(self):
        hut = next(h for h in inventory() if h["key"] == "lagazuoi")
        metrics = Metrics(10, 60, virtual=True)
        with measured_transport(metrics, hut, FixtureSite("foundation", date(2027, 6, 28))) as client:
            for method, url in (
                ("POST", "https://www.rifugiolagazuoi.com/IT/confirm-booking.php"),
                ("GET", "https://evil.test/"),
                ("GET", "http://www.rifugiolagazuoi.com/IT/disponibilita.php"),
            ):
                with self.assertRaises(UnsafeRequest):
                    client.session.request(method, url)
        self.assertEqual(metrics.attempts, [])

    def test_canonical_redirect_rechecks_robots_and_counts_attempts(self):
        class CanonicalFixture(FixtureSite):
            def respond(self, method, url, kind, kwargs):
                response = super().respond(method, url, kind, kwargs)
                if kind != "robots" and "www." in url:
                    response.status_code = 301
                    response.headers["Location"] = "https://rifugiodibona.app/api/search"
                return response

        hut = next(h for h in inventory() if h["key"] == "dibona")
        metrics = Metrics(10, 60, virtual=True)
        with measured_transport(metrics, hut, CanonicalFixture("dibona_app", date(2027, 6, 28))) as client:
            result = client.request("GET", hut["config"]["url"], params={"example": "not-logged"})
        self.assertEqual(result.json(), {"available": True})
        self.assertEqual(len(metrics.attempts), 4)
        self.assertEqual([x["kind"] for x in metrics.attempts], ["robots", "availability", "robots", "availability"])
        self.assertNotIn("example", json.dumps(metrics.attempts))

    def test_html_robots_is_not_accepted_as_permission(self):
        response = requests.Response()
        response.status_code = 200
        response._content = b"<html>Just a moment</html>"
        with self.assertRaises(MalformedResponse):
            validate_response("bukly", "robots", response)

    def test_real_deadline_interrupts_a_stalled_checker_without_network(self):
        with patch.dict("hut_availability.benchmark.core.CHECKERS", {"dibona_app": lambda *_: time.sleep(5)}):
            result = measure_case(spec(mode="live", max_seconds=0.1))
        self.assertEqual(result["outcome"], "budget_exceeded")
        self.assertEqual(result["requests"], 0)
        self.assertLess(result["elapsed_seconds"], 1)

    def test_request_models_count_chunk_month_repeats_and_exclude_manual(self):
        self.assertEqual(request_bounds("suedtirol", date(2027, 6, 28), date(2027, 7, 4)), (4, 4))
        self.assertEqual(request_bounds("foundation", date(2027, 6, 28), date(2027, 7, 4)), (2, 9))
        estimates = estimate_all(inventory(), [], date(2026, 11, 10))
        full = estimates["configured_full"]
        self.assertEqual(full["nights"], 518)
        self.assertLess(estimates["effective_today_forward"]["nights"], full["nights"])
        for chunk in full["chunks"]:
            self.assertEqual({j["system"] for j in chunk["jobs"]}, {"suedtirol", "foundation", "bukly", "dibona_app"})
            self.assertIsNone(chunk["slowest_measured_system_job_normal_estimate"])

    def test_failed_or_virtual_timings_do_not_become_live_estimates(self):
        samples = [measure_case(spec()), measure_case(spec(scenario="denied"))]
        estimates = estimate_all(inventory(), samples, date(2026, 11, 10))
        self.assertEqual(len(estimates["configured_full"]["chunks"][0]["unmeasured_systems"]), 4)

    def test_closed_calendar_does_not_claim_search_endpoint_timing(self):
        sample = measure_case(spec("lagazuoi", "empty", nights=7))
        sample["timing_basis"] = "live_wall_clock"  # Synthetic evidence for model logic only.
        estimates = estimate_all(inventory(), [sample], date(2026, 11, 10))
        jobs = estimates["configured_full"]["chunks"][0]["jobs"]
        foundation = next(job for job in jobs if job["system"] == "foundation")
        self.assertEqual(foundation["untimed_request_kinds"], ["search"])
        self.assertIsNone(foundation["normal_seconds_estimate"])

    def test_child_does_not_inherit_production_secrets(self):
        with patch.dict(os.environ, {"DATABASE_URL": "forbidden", "ADMIN_API_KEY": "forbidden", "PGPASSWORD": "forbidden"}):
            env = child_environment("fixture")
            self.assertFalse({"DATABASE_URL", "ADMIN_API_KEY", "PGPASSWORD"} & env.keys())

    def test_live_requires_explicit_budgets(self):
        with redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as result:
            main(["--live"])
        self.assertEqual(result.exception.code, 2)

    def test_combining_saved_runs_cannot_start_a_checker(self):
        directory = ROOT / "generated-artifacts/scraper-benchmark-tests"
        directory.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=directory) as folder:
            folder = Path(folder)
            saved = folder / "saved.json"
            saved.write_text(json.dumps({
                "mode": "fixture", "cases": [measure_case(spec())],
                "suite_wall_seconds": 0.1,
            }))
            with patch("hut_availability.benchmark.__main__.run_child", side_effect=AssertionError("No worker allowed")):
                result = main([
                    "--combine-results", str(saved), "--output-dir", str(folder / "summary"),
                    "--max-requests", "10", "--max-seconds", "10", "--case-seconds", "1",
                ])
            self.assertEqual(result, 0)
            report = (folder / "summary/report-fixture.md").read_text()
            self.assertIn("virtual clock", report)
            self.assertIn("feasibility is provisional", report)
            self.assertIn("no p95", report)

    def test_fresh_worker_has_no_app_database_or_export_imports(self):
        code = """
import json, sys
from hut_availability.benchmark.core import measure_case
measure_case(json.loads(sys.argv[1]))
forbidden = ['hut_availability.app', 'hut_availability.runner', 'hut_availability.db',
             'hut_availability.models', 'hut_availability.sweep',
             'hut_availability.airtable_sync', 'hut_availability.google_sheets']
assert not any(name in sys.modules for name in forbidden)
"""
        proc = subprocess.run(
            [sys.executable, "-c", code, json.dumps(spec())],
            capture_output=True, text=True, env=child_environment("fixture"), timeout=15,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)

    def test_isolated_child_returns_metrics(self):
        result = run_child({**spec(), "system": "dibona_app"})
        self.assertEqual(result["outcome"], "validated_availability")
        self.assertEqual(result["timing_basis"], "fixture_virtual")
        self.assertGreater(result["process_wall_seconds"], 0)


if __name__ == "__main__":
    unittest.main()
