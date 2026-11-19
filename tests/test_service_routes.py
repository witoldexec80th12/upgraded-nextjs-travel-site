from __future__ import annotations

import os
import re
import unittest
from unittest.mock import Mock, patch

os.environ["ADMIN_API_KEY"] = "test-only-admin-key"
os.environ["SESSION_SECRET"] = "test-only-session-signing-key"
os.environ["ADMIN_ALLOWED_ORIGINS"] = "https://admin.example.test"

from fastapi.testclient import TestClient
from requests import HTTPError

from hut_availability.app import app


class ServiceRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, base_url="https://testserver")
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)

    def test_api_rejects_missing_key_and_lists_seeded_huts_with_key(self):
        denied = self.client.get("/api/huts")
        self.assertEqual(denied.status_code, 401)
        self.assertEqual(denied.headers.get("x-robots-tag"), "noindex, nofollow, noarchive")

        allowed = self.client.get(
            "/api/huts",
            headers={"X-API-Key": "test-only-admin-key"},
        )
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(len(allowed.json()), 26)
        self.assertTrue(any(hut["key"] == "dibona" for hut in allowed.json()))

    def test_cookie_session_authenticates_admin_api_and_requires_csrf_for_writes(self):
        session = self.client.get("/admin/auth/session")
        self.assertEqual(session.status_code, 200)
        self.assertFalse(session.json()["authenticated"])
        pre_login_csrf = session.json()["csrf_token"]

        login = self.client.post(
            "/admin/auth/login",
            json={"api_key": "test-only-admin-key", "csrf_token": pre_login_csrf},
            headers={"X-CSRF-Token": pre_login_csrf},
        )
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.json()["authenticated"])
        csrf = login.json()["csrf_token"]

        huts = self.client.get("/api/huts")
        self.assertEqual(huts.status_code, 200)
        self.assertEqual(len(huts.json()), 26)

        denied_write = self.client.post(
            "/api/checks",
            json={
                "date_from": "2027-06-01",
                "date_to": "2027-08-15",
                "people": 2,
                "huts": ["dibona"],
            },
        )
        self.assertEqual(denied_write.status_code, 403)

        csrf_write = self.client.post(
            "/api/checks",
            json={
                "date_from": "2027-06-01",
                "date_to": "2027-08-15",
                "people": 2,
                "huts": ["dibona"],
            },
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(csrf_write.status_code, 422)

        logout = self.client.post(
            "/admin/auth/logout",
            json={"csrf_token": csrf},
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(logout.status_code, 200)
        self.assertFalse(logout.json()["authenticated"])
        self.assertEqual(self.client.get("/api/huts").status_code, 401)

    def test_admin_api_cors_allows_configured_origin_with_credentials(self):
        response = self.client.options(
            "/api/huts",
            headers={
                "Origin": "https://admin.example.test",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "content-type,x-csrf-token",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get("access-control-allow-origin"),
            "https://admin.example.test",
        )
        self.assertEqual(response.headers.get("access-control-allow-credentials"), "true")

    def test_availability_grid_returns_empty_before_first_check(self):
        response = self.client.get(
            "/api/availability",
            params={
                "date_from": "2027-07-01",
                "date_to": "2027-07-03",
                "people": 2,
            },
            headers={"X-API-Key": "test-only-admin-key"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_daily_sweep_settings_are_admin_only_and_do_not_create_a_workbook_on_read(self):
        denied = self.client.get("/api/sweep/settings")
        self.assertEqual(denied.status_code, 401)

        settings = self.client.get(
            "/api/sweep/settings",
            headers={"X-API-Key": "test-only-admin-key"},
        )
        self.assertEqual(settings.status_code, 200)
        payload = settings.json()
        self.assertIsInstance(payload["enabled"], bool)
        self.assertIn("date_from", payload)
        self.assertIn("date_to", payload)
        self.assertIn("spreadsheet_url", payload)

        denied_setup = self.client.post("/api/sweep/sheets/setup", json={})
        self.assertEqual(denied_setup.status_code, 401)

    def test_check_request_rejects_ranges_over_limit_without_queueing(self):
        response = self.client.post(
            "/api/checks",
            json={
                "date_from": "2027-06-01",
                "date_to": "2027-08-15",
                "people": 2,
                "huts": ["dibona"],
            },
            headers={"X-API-Key": "test-only-admin-key"},
        )
        self.assertEqual(response.status_code, 422)

    @patch("hut_availability.api_routes.sync_latest")
    def test_airtable_errors_do_not_echo_sensitive_request_urls(self, mocked_sync):
        error = HTTPError("https://api.airtable.com/v0/private-base/AV1%20Availability")
        error.response = Mock(status_code=404)
        mocked_sync.side_effect = error
        response = self.client.post(
            "/api/airtable/sync",
            json={
                "date_from": "2027-07-15",
                "date_to": "2027-07-15",
                "people": 2,
            },
            headers={"X-API-Key": "test-only-admin-key"},
        )
        self.assertEqual(response.status_code, 502)
        self.assertIn("base or table", response.json()["detail"])
        self.assertNotIn("private-base", response.text)

    def test_admin_login_and_dashboard(self):
        redirect = self.client.get("/admin", follow_redirects=False)
        self.assertEqual(redirect.status_code, 303)
        self.assertEqual(redirect.headers["location"], "/admin/login")

        login_page = self.client.get("/admin/login")
        self.assertEqual(login_page.status_code, 200)
        csrf_match = re.search(r'name="csrf" value="([^"]+)"', login_page.text)
        self.assertIsNotNone(csrf_match)

        login = self.client.post(
            "/admin/login",
            data={"csrf": csrf_match.group(1), "api_key": "test-only-admin-key"},
            follow_redirects=False,
        )
        self.assertEqual(login.status_code, 303)
        dashboard = self.client.get("/admin")
        self.assertEqual(dashboard.status_code, 200)
        self.assertIn("Rifugio Fodara Vedla", dashboard.text)
        self.assertIn("Check these huts by hand", dashboard.text)


if __name__ == "__main__":
    unittest.main()
