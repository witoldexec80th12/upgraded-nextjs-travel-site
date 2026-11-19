from __future__ import annotations

import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse
from unittest.mock import patch

import requests
from bs4 import BeautifulSoup

from hut_availability.checkers import base


class BudgetExceeded(RuntimeError):
    pass


class MalformedResponse(RuntimeError):
    pass


class AccessDenied(RuntimeError):
    pass


class UnsafeRequest(RuntimeError):
    pass


@dataclass
class Metrics:
    max_requests: int
    max_seconds: float
    virtual: bool = False
    elapsed_virtual: float = 0.0
    started: float = field(default_factory=time.monotonic)
    network_seconds: float = 0.0
    pacing_seconds: float = 0.0
    retry_backoff_seconds: float = 0.0
    attempts: list[dict] = field(default_factory=list)
    retry_sleeps: int = 0
    sleep_kind: str = "retry_backoff"

    def monotonic(self):
        # Keep a large origin: the production client's initial last-request value is 0.
        return 1_000_000 + self.elapsed_virtual if self.virtual else time.monotonic()

    def elapsed(self):
        return self.elapsed_virtual if self.virtual else time.monotonic() - self.started

    def remaining(self):
        return max(0.0, self.max_seconds - self.elapsed())

    def require_time(self):
        if self.remaining() <= 0:
            raise BudgetExceeded("Elapsed-time budget exhausted")

    def sleep(self, seconds):
        self.require_time()
        if seconds >= self.remaining():
            raise BudgetExceeded("Required wait exceeds remaining budget")
        if self.sleep_kind == "retry_backoff":
            self.retry_sleeps += 1
        started = self.monotonic()
        try:
            if self.virtual:
                self.elapsed_virtual += seconds
            else:
                time.sleep(seconds)
        finally:
            attr = f"{self.sleep_kind}_seconds"
            setattr(self, attr, getattr(self, attr) + self.monotonic() - started)


def validate_response(system: str, kind: str, response: requests.Response):
    """Evidence guard: existing HTML checkers can otherwise call arbitrary HTML 'full'."""
    if kind == "robots":
        if 200 <= response.status_code < 300 and any(
            marker in response.text.lower() for marker in ("<html", "<!doctype html", "verify you are human")
        ):
            raise MalformedResponse("HTML is not a usable robots policy")
        return
    if response.status_code in {401, 403}:
        raise AccessDenied("Provider denied access")
    if not 200 <= response.status_code < 300:
        return  # Preserve the production client's HTTP error and retry behavior.
    if system in {"suedtirol", "dibona_app"}:
        try:
            data = response.json()
        except ValueError:
            raise MalformedResponse("Expected JSON") from None
        if system == "dibona_app":
            if not isinstance(data, dict) or not isinstance(data.get("available"), bool):
                raise MalformedResponse("No explicit boolean availability")
        elif not isinstance(data, list) or any(
            not isinstance(item, dict)
            or not isinstance(item.get("date"), str)
            or not isinstance(item.get("departures"), list)
            or any(
                not isinstance(dep, dict)
                or not isinstance(dep.get("departure"), str)
                or not isinstance(dep.get("rule"), str)
                for dep in item["departures"]
            )
            for item in data
        ):
            raise MalformedResponse("Unexpected monthly availability schema")
        return
    soup = BeautifulSoup(response.text, "html.parser")
    visible = soup.get_text(" ", strip=True).lower()
    if any(word in visible for word in (
        "verify you are human", "access denied", "just a moment", "captcha",
        "checking your browser",
    )):
        raise AccessDenied("Challenge page, not availability")
    if system == "foundation":
        if kind == "calendar":
            if not soup.select_one("#TabDisp th[colspan]"):
                raise MalformedResponse("Calendar structure not recognized")
        elif not soup.select_one('select option[value="0"]') and not any(
            marker in visible for marker in ("sold out", "esaurit", "ausgebucht", "non disponibil")
        ):
            raise MalformedResponse("Booking offers or sold-out message not recognized")
    elif system == "bukly":
        if soup.select_one("[data-page]"):
            from hut_availability.checkers.bukly_v2 import page_payload
            try:
                page_payload(response.text)
            except ValueError:
                raise MalformedResponse("Bukly search payload not recognized") from None
            return
        offers = soup.select_one('.hotel-room__sub select[name^="data[Room]"]')
        grid = any(
            table.select_one("td div")
            and any(month in table.get_text() for month in
                    ("Jan ", "Feb ", "Mar ", "Apr ", "May ", "Jun ",
                     "Jul ", "Aug ", "Sep ", "Oct ", "Nov ", "Dec "))
            for table in soup.find_all("table")
        )
        if not offers and not grid and not any(
            marker in visible for marker in ("sold out", "no availability", "no rooms available")
        ):
            raise MalformedResponse("Offers, dated grid, or sold-out message not recognized")


class MeasuredClient(base.SiteClient):
    def __init__(self, metrics, hut, fixture=None):
        super().__init__()
        self.metrics = metrics
        self.pause_seconds = max(2.0, self.pause_seconds)  # Never lower the configured interval.
        self.session.close()
        self.session = MeasuredSession(metrics, hut, self, fixture)

    def _wait_for_site(self, host, extra_delay=0):
        previous = self.metrics.sleep_kind
        self.metrics.sleep_kind = "pacing"
        try:
            return super()._wait_for_site(host, extra_delay)
        finally:
            self.metrics.sleep_kind = previous


class MeasuredSession(requests.Session):
    def __init__(self, metrics, hut, client, fixture):
        super().__init__()
        self.trust_env = False  # No netrc credentials or environment auth.
        self.headers["User-Agent"] = base.USER_AGENT
        self.metrics, self.hut, self.client, self.fixture = metrics, hut, client, fixture
        cfg = hut["config"]
        system = hut["system"]
        self.allowed = (
            {("GET", cfg["cal"]): "calendar", ("POST", cfg["search"]): "search"}
            if system == "foundation" else
            {("GET", cfg["url"]): "availability"} if system == "dibona_app" else
            {("GET", f"https://api.widgets.bookingsuedtirol.com/v6/properties/{cfg['property']}/availabilities"): "availability"}
            if system == "suedtirol" else {}
        )
        self.hosts = {urlparse(url).hostname for _, url in self.allowed}
        if system == "bukly":
            self.hosts = {f"{cfg['sub']}.bukly.com"}
        # A site's www/non-www canonical redirect is not a different provider.
        # Each alias still gets its own robots check and pacing.
        originals = list(self.allowed.items())
        for (method, url), kind in originals:
            parsed = urlparse(url)
            alias = parsed.hostname.removeprefix("www.") if parsed.hostname.startswith("www.") else f"www.{parsed.hostname}"
            self.allowed[(method, f"https://{alias}{parsed.path}")] = kind
        self.hosts |= {
            h.removeprefix("www.") if h.startswith("www.") else f"www.{h}"
            for h in list(self.hosts)
        }

    def request(self, method, url, **kwargs):
        method = method.upper()
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.username or parsed.password or parsed.hostname not in self.hosts:
            raise UnsafeRequest("Only the selected public HTTPS booking host is allowed")
        clean = f"https://{parsed.netloc}{parsed.path}"
        kind = "robots" if parsed.path == "/robots.txt" and method == "GET" else self.allowed.get((method, clean))
        if self.hut["system"] == "bukly" and method == "GET" and (
            parsed.path == "/booking" or parsed.path.startswith("/en-us/hotel/")
        ):
            kind = "availability"
        if not kind:
            raise UnsafeRequest("Endpoint is outside read-only availability allowlist")
        m = self.metrics
        m.require_time()
        if len(m.attempts) >= m.max_requests:
            raise BudgetExceeded("Request budget exhausted")
        entry = {"host": parsed.hostname, "kind": kind, "method": method, "status": None, "bytes": 0}
        m.attempts.append(entry)
        started = m.monotonic()
        try:
            if self.fixture:
                response = self.fixture.respond(method, url, kind, kwargs)
                m.elapsed_virtual += 0.05
            else:
                timeout = min(float(kwargs.pop("timeout", 30)), m.remaining())
                kwargs.pop("allow_redirects", None)
                response = super().request(
                    method, url, timeout=(min(10, timeout), timeout),
                    allow_redirects=False, stream=True, **kwargs,
                )
                entry["status"] = response.status_code
                content = bytearray()
                try:
                    for block in response.iter_content(65536):
                        m.require_time()
                        content.extend(block)
                        if len(content) > 2_000_000:
                            raise BudgetExceeded("Response size exceeds benchmark safety limit")
                    response._content = bytes(content)
                    response._content_consumed = True
                finally:
                    response.close()
            entry.update(status=response.status_code, bytes=len(response.content))
        except Exception as exc:
            entry["exception"] = type(exc).__name__  # Never persist exception messages/URLs.
            raise
        finally:
            entry["network_seconds"] = round(m.monotonic() - started, 6)
            m.network_seconds += m.monotonic() - started
        if 300 <= response.status_code < 400:
            # Follow only an allowlisted same-host redirect; never submit to unknown paths.
            target = urljoin(url, response.headers.get("Location", ""))
            target_parsed = urlparse(target)
            entry["redirect"] = {
                "scheme": target_parsed.scheme, "host": target_parsed.hostname,
                "canonical_alias": bool(target_parsed.hostname) and
                target_parsed.hostname.removeprefix("www.") == parsed.hostname.removeprefix("www."),
            }
            if not response.headers.get("Location") or not entry["redirect"]["canonical_alias"]:
                raise UnsafeRequest("Cross-site or missing redirect target; not followed")
            if sum(a.get("status") in range(300, 400) for a in m.attempts if a.get("status")) > 3:
                raise UnsafeRequest("Redirect budget exhausted")
            if kind != "robots":
                parser = self.client._robots_for(target)
                if not parser.can_fetch(base.USER_AGENT, target):
                    raise base.ScrapePolicyError("Redirect disallowed by robots.txt")
            self.client._wait_for_site(target_parsed.hostname)
            kwargs.pop("params", None)  # Location, not the original request, owns the next query.
            if response.status_code == 303 or (method == "POST" and response.status_code in {301, 302}):
                method = "GET"
                kwargs.pop("data", None)
            return self.request(method, target, **kwargs)
        validate_response(self.hut["system"], kind, response)
        return response


@contextmanager
def measured_transport(metrics, hut, fixture=None):
    client = MeasuredClient(metrics, hut, fixture)
    try:
        with patch.object(base, "CLIENT", client), patch.object(base, "time", metrics):
            yield client
    finally:
        client.session.close()
