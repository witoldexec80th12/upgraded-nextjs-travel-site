"""Request-count model, not a claim that unmeasured responses will be fast."""
from collections import Counter, defaultdict
from datetime import date, timedelta
from urllib.parse import urlparse


def chunks(start, end, size):
    while start <= end:
        last = min(end, start + timedelta(days=size - 1))
        yield start, last
        start = last + timedelta(days=1)


def month_count(start, end):
    return (end.year - start.year) * 12 + end.month - start.month + 1


def request_bounds(system, start, end):
    nights = (end - start).days + 1
    months = month_count(start, end)
    if system == "suedtirol":
        return 2 * months, 2 * months
    if system == "foundation":
        return months, months + nights  # Valid closed calendars can avoid night searches.
    if system == "bukly":
        # Calendar shortcuts can cover later closed dates; complex groups use at
        # most six layouts/night. Includes first-night legacy detection overhead.
        return 1, 6 * nights
    return nights, nights


def workload(huts, start, end, size, live_cases):
    successful = [c for c in live_cases if c.get("timing_basis") == "live_wall_clock" and c["outcome"].startswith("validated_")]
    latency = defaultdict(list)
    for case in successful:
        for attempt in case["attempts"]:
            if attempt["kind"] != "robots" and attempt["status"] == 200:
                latency[(case["system"], attempt["kind"])].append(attempt["network_seconds"])
    jobs = []
    hosts = set()
    by_system = Counter()
    for hut in huts:
        system = hut["system"]
        if system == "manual":
            continue
        cfg = hut["config"]
        host = (
            "api.widgets.bookingsuedtirol.com" if system == "suedtirol" else
            f"{cfg['sub']}.bukly.com" if system == "bukly" else
            urlparse(cfg["cal"] if system == "foundation" else cfg["url"]).hostname
        )
        hosts.add(host)
        for first, last in chunks(start, end, size):
            low, high = request_bounds(system, first, last)
            # Conservative normal-response scenario: full 2s pause PLUS network time.
            # Current pacing overlaps part of response time; this intentionally overestimates.
            required_kinds = ("calendar", "search") if system == "foundation" else ("availability",)
            missing_kinds = [kind for kind in required_kinds if not latency.get((system, kind))]
            observed = [
                seconds for kind in required_kinds
                for seconds in latency.get((system, kind), [])
            ] if not missing_kinds else []
            per_request = 2 + max(observed) if observed else None
            normal = (high + 1) * per_request if per_request else None
            jobs.append({
                "hut": hut["key"], "system": system, "host": host,
                "nights": (last - first).days + 1,
                "requests_low": low, "requests_high": high,
                "normal_seconds_estimate": round(normal, 2) if normal is not None else None,
                "evidence": "successful_live_sample" if observed else "no_successful_live_sample",
                "untimed_request_kinds": missing_kinds,
            })
            by_system[system] += high
    upper = sum(j["requests_high"] for j in jobs)
    return {
        "chunk_nights": size, "job_count": len(jobs),
        "request_lower_scenario": sum(j["requests_low"] for j in jobs),
        "request_upper_scenario": upper,
        "upper_by_system": dict(by_system),
        "request_model_excludes_redirects_and_retries": True,
        "robots_requests_warm_serial": len(hosts) if jobs else 0,
        "robots_requests_cold_per_job": len(jobs),
        "conservative_pacing_only_seconds_cold": (upper + len(jobs)) * 2,
        "slowest_measured_system_job_normal_estimate": max(
            (j["normal_seconds_estimate"] for j in jobs if j["normal_seconds_estimate"] is not None),
            default=None,
        ),
        "unmeasured_systems": sorted({j["system"] for j in jobs if j["evidence"] != "successful_live_sample"}),
        "jobs": jobs,
    }


def estimate_all(huts, cases, as_of, start=date(2026, 6, 1), end=date(2027, 10, 31)):
    windows = {}
    for label, first in (("configured_full", start), ("effective_today_forward", max(start, as_of))):
        windows[label] = {
            "date_from": first.isoformat(), "date_to": end.isoformat(),
            "nights": max(0, (end-first).days+1),
            "chunks": [workload(huts, first, end, size, cases) for size in (7, 14, 31, 62)],
        }
    return windows
