from __future__ import annotations

import os
import threading
import time
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import requests

USER_AGENT = "Mozilla/5.0 (hut-availability-check; personal trip planning)"


class ScrapePolicyError(RuntimeError):
    """Raised when a remote site's policy or response prevents a safe check."""


class SiteClient:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self.pause_seconds = max(0.0, float(os.getenv("REQUEST_PAUSE_SECONDS", "2")))
        self._robots: dict[str, RobotFileParser | None] = {}
        self._last_request: dict[str, float] = {}
        self._lock = threading.Lock()

    def _host(self, url: str) -> str:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ScrapePolicyError("Only public HTTP(S) URLs can be checked.")
        return parsed.hostname.lower()

    def _wait_for_site(self, host: str, extra_delay: float = 0.0) -> None:
        delay = max(self.pause_seconds, extra_delay)
        with self._lock:
            elapsed = time.monotonic() - self._last_request.get(host, 0.0)
            if elapsed < delay:
                time.sleep(delay - elapsed)
            self._last_request[host] = time.monotonic()

    def _robots_for(self, url: str) -> RobotFileParser:
        parsed = urlparse(url)
        host = self._host(url)
        if host in self._robots:
            parser = self._robots[host]
            if parser is None:
                raise ScrapePolicyError(f"robots.txt could not be checked for {host}.")
            return parser

        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        response = None
        for backoff in (30, 120, None):
            self._wait_for_site(host)
            try:
                response = self.session.get(robots_url, timeout=15)
            except requests.RequestException as exc:
                self._robots[host] = None
                raise ScrapePolicyError(f"Could not check robots.txt for {host}: {exc}") from exc
            if response.status_code == 429 or 500 <= response.status_code <= 599:
                if backoff is None:
                    self._robots[host] = None
                    raise ScrapePolicyError(
                        f"robots.txt for {host} continued returning HTTP {response.status_code}."
                    )
                time.sleep(backoff)
                continue
            break
        if response is None:
            raise ScrapePolicyError(f"Could not check robots.txt for {host}.")

        parser = RobotFileParser(robots_url)
        if response.status_code in {404, 410}:
            parser.parse(["User-agent: *", "Allow: /"])
        elif response.status_code in {401, 403} or response.status_code >= 500:
            self._robots[host] = None
            raise ScrapePolicyError(f"robots.txt for {host} returned HTTP {response.status_code}.")
        elif response.status_code >= 400:
            self._robots[host] = None
            raise ScrapePolicyError(f"Could not check robots.txt for {host}: HTTP {response.status_code}.")
        else:
            parser.parse(response.text.splitlines())
        self._robots[host] = parser
        return parser

    def request(self, method: str, url: str, **kwargs: object) -> requests.Response:
        host = self._host(url)
        parser = self._robots_for(url)
        if not parser.can_fetch(USER_AGENT, url):
            raise ScrapePolicyError(f"robots.txt disallows this availability URL on {host}.")
        crawl_delay = parser.crawl_delay(USER_AGENT) or 0
        timeout = kwargs.pop("timeout", 30)

        for attempt, backoff in enumerate((30, 120, None)):
            self._wait_for_site(host, crawl_delay)
            try:
                response = self.session.request(method, url, timeout=timeout, **kwargs)
            except requests.RequestException:
                raise
            if response.status_code == 429 or 500 <= response.status_code <= 599:
                if backoff is None:
                    response.raise_for_status()
                time.sleep(backoff)
                continue
            response.raise_for_status()
            return response
        raise RuntimeError("Availability request retry loop ended unexpectedly.")


CLIENT = SiteClient()


def http(method: str, url: str, **kwargs: object) -> requests.Response:
    return CLIENT.request(method, url, **kwargs)
