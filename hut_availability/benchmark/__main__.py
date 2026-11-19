"""Run with: uv run --no-sync python -m hut_availability.benchmark --help"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from hut_availability.benchmark.core import ROOT, REPRESENTATIVES, inventory, measure_case
from hut_availability.benchmark.estimates import estimate_all
from hut_availability.benchmark.report import render_report


def child_environment(mode):
    allowed = {"PATH", "LANG", "LC_ALL", "PYTHONPATH", "SSL_CERT_FILE", "SSL_CERT_DIR", "REQUESTS_CA_BUNDLE", "REQUEST_PAUSE_SECONDS"}
    return {**{k: v for k, v in os.environ.items() if k in allowed},
            "HUT_BENCHMARK_CHILD_MODE": mode}


def run_child(spec, wall_timeout=None):
    started = time.monotonic()
    process = subprocess.Popen(
        [sys.executable, "-m", "hut_availability.benchmark", "--worker"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, cwd=ROOT, env=child_environment(spec["mode"]),
    )
    try:
        stdout, _ = process.communicate(
            json.dumps(spec), timeout=min(spec["max_seconds"] + 3, wall_timeout)
            if wall_timeout is not None else spec["max_seconds"] + 3,
        )
        if process.returncode:
            raise RuntimeError("Isolated benchmark process failed; stderr withheld")
        result = json.loads(stdout)
    except subprocess.TimeoutExpired:
        process.kill()
        process.communicate()
        return {
            "hut": spec["hut"], "system": spec["system"], "nights": spec["nights"],
            "outcome": "hard_timeout", "requests": spec["max_requests"],
            "request_count_is_conservative_budget_not_measured": True,
            "elapsed_seconds": time.monotonic() - started,
            "timing_basis": "live_wall_clock" if spec["mode"] == "live" else "fixture_virtual",
        }
    process_seconds = time.monotonic() - started
    result["process_wall_seconds"] = round(process_seconds, 6)
    result["local_process_startup_and_teardown_seconds"] = (
        round(max(0, process_seconds - result["elapsed_seconds"]), 6)
        if spec["mode"] == "live" else None
    )
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Explicitly permit bounded public availability requests")
    parser.add_argument("--max-requests", type=int, help="Total wire-attempt budget, including robots and redirects; required for live")
    parser.add_argument("--max-seconds", type=float, help="Suite wall-time budget; required for live")
    parser.add_argument("--case-seconds", type=float, default=45, help="Hard per-case wall deadline (default 45)")
    parser.add_argument("--huts", nargs="+", choices=REPRESENTATIVES, default=REPRESENTATIVES)
    parser.add_argument("--combine-results", nargs="+", type=Path, help="Combine saved runs into one report, with no network requests")
    parser.add_argument("--sample-start", type=date.fromisoformat, default=date(date.today().year+1, 6, 28))
    parser.add_argument("--window-start", type=date.fromisoformat, default=date(2026, 6, 1))
    parser.add_argument("--window-end", type=date.fromisoformat, default=date(2027, 10, 31))
    parser.add_argument("--as-of", type=date.fromisoformat, default=datetime.now(ZoneInfo("Europe/Madrid")).date())
    parser.add_argument("--output-dir", type=Path, default=ROOT / "generated-artifacts/scraper-benchmark")
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    if args.worker:
        spec = json.load(sys.stdin)
        if os.environ.get("HUT_BENCHMARK_CHILD_MODE") != spec.get("mode"):
            parser.error("Worker requires the explicit parent benchmark invocation")
        print(json.dumps(measure_case(spec)))
        return 0
    if args.live and (args.max_requests is None or args.max_seconds is None):
        parser.error("--live requires explicit --max-requests and --max-seconds")
    max_requests = args.max_requests if args.max_requests is not None else 80
    max_seconds = args.max_seconds if args.max_seconds is not None else 180
    if not 1 <= max_requests <= 1000 or not 1 <= max_seconds <= 3600:
        parser.error("Budgets must be 1–1000 requests and 1–3600 seconds")
    if not 1 <= args.case_seconds <= max_seconds:
        parser.error("--case-seconds must be positive and no larger than --max-seconds")
    if args.window_start > args.window_end:
        parser.error("Window start must not follow window end")
    if args.live and args.sample_start <= args.as_of:
        parser.error("Live samples must use future overnight dates")
    if args.sample_start.month == (args.sample_start + timedelta(days=6)).month:
        parser.error("The seven-night sample must cross a month boundary")
    output_dir = args.output_dir.resolve()
    if not output_dir.is_relative_to((ROOT / "generated-artifacts").resolve()):
        parser.error("Output must stay inside ignored generated-artifacts")
    output_dir.mkdir(parents=True, exist_ok=True)
    mode = "live" if args.live else "fixture"
    data = {
        "mode": mode, "created_at": datetime.now(timezone.utc).isoformat(),
        "environment": "local process; not Vercel",
        "vercel_account_configuration": "unknown; no deployment authorized or available",
        "budget": {"max_requests": max_requests, "max_seconds": max_seconds,
                   "case_seconds": args.case_seconds},
        "reference_settings_source": "CLI / checked-in defaults; production settings are NOT queried",
        "cases": [],
    }
    if args.combine_results:
        if args.live:
            parser.error("--combine-results cannot be combined with --live")
        runs = []
        for path in args.combine_results:
            if not path.resolve().is_relative_to((ROOT / "generated-artifacts").resolve()):
                parser.error("Saved results must be inside generated-artifacts")
            run = json.loads(path.read_text())
            runs.append(run)
            label = str(path.parent.resolve().relative_to(ROOT))
            data["cases"].extend({**case, "source_run": label} for case in run["cases"])
        modes = {run["mode"] for run in runs}
        if len(modes) != 1:
            parser.error("Do not combine real and virtual timing runs")
        mode = data["mode"] = modes.pop()
        data["suite_wall_seconds"] = sum(run["suite_wall_seconds"] for run in runs)
        data["source_runs"] = [str(path.resolve().relative_to(ROOT)) for path in args.combine_results]
        data["is_combined_report"] = True
        if sum(c.get("requests", 0) for c in data["cases"]) > max_requests or data["suite_wall_seconds"] > max_seconds:
            parser.error("Saved runs exceed declared cumulative budget")
        data["estimates"] = estimate_all(
            inventory(), data["cases"], args.as_of, args.window_start, args.window_end
        )
        (output_dir / f"results-{mode}.json").write_text(json.dumps(data, indent=2) + "\n")
        (output_dir / f"report-{mode}.md").write_text(render_report(data))
        print(f"Combined saved runs in {output_dir.relative_to(ROOT)}; no requests made.")
        return 0
    json_path = output_dir / f"results-{mode}.json"
    started = time.monotonic()
    used = 0
    for key in dict.fromkeys(args.huts):
        hut = next(h for h in inventory() if h["key"] == key)
        baseline_ok = True
        for count in (1, 7):
            remaining = max_seconds - (time.monotonic() - started)
            if not baseline_ok or remaining < 2 or used >= max_requests:
                result = {
                    "hut": key, "system": hut["system"], "nights": count,
                    "outcome": "skipped_after_failed_baseline" if not baseline_ok else "skipped_suite_budget",
                }
            else:
                spec = {
                    "hut": key, "system": hut["system"], "nights": count,
                    "start": args.sample_start.isoformat(), "mode": mode,
                    "max_requests": min(24, max_requests-used),
                    "max_seconds": min(args.case_seconds, remaining-1),
                }
                result = run_child(spec, wall_timeout=remaining)
                used += result["requests"]
                baseline_ok = result["outcome"].startswith("validated_")
                if result["outcome"] == "hard_timeout":
                    # A killed child cannot report an exact attempt count. Stop safely.
                    used = max_requests
            data["cases"].append(result)
            print(f"{key}, {count} night(s): {result['outcome']}; {result.get('elapsed_seconds', 0):.3f}s; {result.get('requests', 0)} requests", flush=True)
            json_path.write_text(json.dumps(data, indent=2) + "\n")
    data["suite_wall_seconds"] = round(time.monotonic() - started, 6)
    data["estimates"] = estimate_all(
        inventory(), data["cases"], args.as_of, args.window_start, args.window_end
    )
    json_path.write_text(json.dumps(data, indent=2) + "\n")
    report_path = output_dir / f"report-{mode}.md"
    report_path.write_text(render_report(data))
    print(f"Raw results: {json_path.relative_to(ROOT)}")
    print(f"Report: {report_path.relative_to(ROOT)}")
    # Access failures are recorded benchmark findings, not a crashed harness.
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        # Do not leak transport exception text, response HTML, or environment values.
        print(f"Benchmark failed: {type(error).__name__}; details withheld.", file=sys.stderr)
        sys.exit(1)
