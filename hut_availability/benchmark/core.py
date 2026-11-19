from __future__ import annotations

import csv
import json
import resource
import signal
import time
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

import requests

from hut_availability.checkers import CHECKERS
from hut_availability.checkers.base import ScrapePolicyError
from hut_availability.benchmark.fixtures import FixtureSite
from hut_availability.benchmark.transport import (
    AccessDenied, BudgetExceeded, MalformedResponse, Metrics, UnsafeRequest,
    measured_transport,
)

ROOT = Path(__file__).resolve().parents[2]
REPRESENTATIVES = ("fodara", "scotoni", "lagazuoi", "dibona")


def inventory():
    # Deliberately use the checked-in public directory, not DATABASE_URL.
    with (ROOT / "hut_availability/huts_seed.csv").open(encoding="utf-8", newline="") as handle:
        return [
            {**row, "config": json.loads(row["config"] or "{}")}
            for row in csv.DictReader(handle)
            if row["active"].lower() == "true"
        ]


def measure_case(spec):
    hut = next(h for h in inventory() if h["key"] == spec["hut"])
    if hut["system"] not in CHECKERS:
        raise ValueError("Manual huts cannot be benchmarked")
    start = date.fromisoformat(spec["start"])
    count = int(spec["nights"])
    if not 1 <= count <= 62:
        raise ValueError("Benchmark cases must contain 1 through 62 nights")
    end = start + timedelta(days=count - 1)
    virtual = spec["mode"] == "fixture"
    metrics = Metrics(spec["max_requests"], spec["max_seconds"], virtual=virtual)
    fixture = FixtureSite(hut["system"], start, spec.get("scenario", "available")) if virtual else None
    result = {
        "hut": hut["key"], "system": hut["system"], "date_from": start.isoformat(),
        "date_to": end.isoformat(), "nights": count,
        "timing_basis": "fixture_virtual" if virtual else "live_wall_clock",
        "outcome": "not_started", "status_counts": {}, "exception_type": None,
    }
    cpu_start = time.process_time()

    def deadline(*_):
        raise BudgetExceeded("Hard elapsed deadline")

    previous_handler = None
    if not virtual:
        previous_handler = signal.signal(signal.SIGALRM, deadline)
        signal.setitimer(signal.ITIMER_REAL, metrics.max_seconds)
    try:
        with measured_transport(metrics, hut, fixture):
            rows = CHECKERS[hut["system"]](hut["name"], hut["config"], start, end, 2)
        expected = {start + timedelta(days=i) for i in range(count)}
        if {row[0] for row in rows} != expected or len(rows) != count:
            raise MalformedResponse("Dates missing or duplicated")
        statuses = Counter(row[1] for row in rows)
        if not set(statuses) <= {"available", "partial", "full", "closed", "min_stay", "error"}:
            raise MalformedResponse("Unexpected availability status")
        result["status_counts"] = dict(statuses)
        result["outcome"] = (
            "unconfirmed_availability" if "error" in statuses else
            "validated_no_availability"
            if set(statuses) <= {"full", "closed", "min_stay"} else "validated_availability"
        )
    except Exception as exc:
        result["exception_type"] = type(exc).__name__
        result["outcome"] = (
            "budget_exceeded" if isinstance(exc, BudgetExceeded) else
            "access_denied" if isinstance(exc, AccessDenied) else
            "policy_denied" if isinstance(exc, ScrapePolicyError) else
            "unsafe_redirect_or_endpoint" if isinstance(exc, UnsafeRequest) else
            "malformed_response" if isinstance(exc, (MalformedResponse, ValueError, KeyError, TypeError)) else
            "timeout" if isinstance(exc, requests.Timeout) else
            "http_error" if isinstance(exc, requests.HTTPError) else
            "network_error" if isinstance(exc, requests.RequestException) else "checker_error"
        )
        # No exception text: HTTP errors can contain query parameters or HTML.
    finally:
        if not virtual:
            signal.setitimer(signal.ITIMER_REAL, 0)
            signal.signal(signal.SIGALRM, previous_handler)
    elapsed = metrics.elapsed()
    result.update(
        elapsed_seconds=round(elapsed, 6),
        network_seconds=round(metrics.network_seconds, 6),
        pacing_seconds=round(metrics.pacing_seconds, 6),
        retry_backoff_seconds=round(metrics.retry_backoff_seconds, 6),
        retry_sleeps=metrics.retry_sleeps,
        parse_validation_and_checker_seconds=round(max(
            0, elapsed - metrics.network_seconds - metrics.pacing_seconds - metrics.retry_backoff_seconds
        ), 6),
        cpu_seconds=round(time.process_time() - cpu_start, 6),
        peak_process_memory_mib=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 3),
        requests=len(metrics.attempts),
        response_bytes=sum(a["bytes"] for a in metrics.attempts),
        attempts=metrics.attempts,
    )
    return result
