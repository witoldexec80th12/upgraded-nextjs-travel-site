from collections import Counter


def render_report(data):
    live = data["mode"] == "live"
    lines = [
        "# Scraper benchmark and Vercel fit", "",
        f"Generated: {data['created_at']}. Mode: **{data['mode']}**.",
        "**Vercel feasibility is provisional: no Vercel benchmark deployment or account plan was provided.**",
        "No database, API startup, background worker, Airtable, Google Sheets, booking submission, or production deployment is invoked by this harness.",
        "",
        "## Method and limits",
        f"- Total budget: {data['budget']['max_requests']} wire attempts and {data['budget']['max_seconds']} seconds, including child startup and waits.",
        "- One-night and seven-night cases, with the seven-night case crossing a month boundary. Four representative huts; two people.",
        "- Each case is a separate process (cold interpreter and robots cache). Seven-night cases are skipped after a rejected/failed one-night case.",
        "- Production policy checks, 2-second minimum per-host pacing, 30/120-second retry backoffs remain in effect. No parallelism.",
        "- Only allowlisted HTTPS availability endpoints are allowed. Canonical www/non-www redirects get policy checks; other cross-site redirects are not followed. Bodies are capped at 2 MB.",
        "- Peak memory is Linux process high-water RSS, including imports. It is not container memory or a Vercel memory measurement.",
        "- Parser/checker time is a residual including response validation, not isolated BeautifulSoup CPU time. Network time includes body download.",
        "- Process startup/teardown is measured locally; it is NOT Vercel cold-start time.",
        "- Successful HTTP responses must pass a separate structural guard. This guard is benchmark-only and does not fix production checker parsers.",
        "- No raw response bodies, cookies, query strings, guest data, or credentials are stored.",
        "- Future-season no-availability responses may reflect unopened booking dates; they do not establish year-round correctness.",
        "- The modeled configured window comes from CLI/checked-in defaults, not a read of production settings.",
        "",
        "## Measured cases",
        "| Hut/system | Nights | Outcome | Elapsed s | Requests | Network s | Pacing s | Backoff s | Peak MiB |",
        "|---|---:|---|---:|---:|---:|---:|---:|---:|",
    ]
    for c in data["cases"]:
        lines.append(
            f"| {c['hut']} / {c['system']} | {c['nights']} | {c['outcome']} | {c.get('elapsed_seconds', 0):.3f}"
            f" | {c.get('requests', 0)} | {c.get('network_seconds', 0):.3f} | {c.get('pacing_seconds', 0):.3f}"
            f" | {c.get('retry_backoff_seconds', 0):.3f} | {c.get('peak_process_memory_mib', 0):.1f} |"
        )
    lines += ["", "Each measured case has sample size **1**; no p95 or production reliability claim is made."]
    valid = [c for c in data["cases"] if c["outcome"].startswith("validated_")]
    if valid:
        lines.append(f"Worst observed validated case: {max(c['elapsed_seconds'] for c in valid):.3f}s.")
    if data.get("is_combined_report"):
        lines += [
            "This combines the initial run and a narrowly scoped canonical-redirect recheck.",
            "Repeated hut/night rows are separate cases from different harness versions, not repeatability statistics.",
            f"Total live wire attempts: {sum(c.get('requests', 0) for c in data['cases'])}; summed suite wall time: {data['suite_wall_seconds']:.3f}s.",
        ]
    if not live:
        lines.append("**Fixture elapsed/network/pacing values use a virtual clock. They verify the harness only and are not hosting-performance measurements.**")
    lines += ["", "## Workload estimates (not full live sweeps)",
              "Inventory: 14 automated huts and 12 manual-only huts. Manual huts contribute zero scraping requests.",
              "Low scenarios rely on closed-calendar or all-full-grid shortcuts; they are NOT guaranteed minima in real runs.",
              "Upper scenarios assume a search per night where applicable. Month requests are counted again at chunk boundaries.",
              "Counts exclude redirects and retries. Robots counts are nominal (one per configured host); canonical aliases can add robots checks and redirects, as the raw measurements show.",
              "One warm serial worker amortizes robots lookups per host; cold Vercel jobs fetch policy again.",
              "Pacing-only scenarios conservatively add 2 seconds per attempt; production pacing can overlap network time.",
              "Network-based estimates use the worst validated sampled response for that system, not failed/rejected responses.",
              "A system has no empirical upper-job timing estimate until every required request type was timed successfully. In particular a closed Foundation calendar does not time its nightly search endpoint.",
              ""]
    for name, window in data["estimates"].items():
        lines += [
            f"### {name}: {window['date_from']}–{window['date_to']} ({window['nights']} nights)",
            "| Chunk nights | Jobs | Availability requests low–high | Robots warm/cold | Conservative pacing-only s (cold) |",
            "|---:|---:|---:|---:|---:|",
        ]
        for item in window["chunks"]:
            lines.append(
                f"| {item['chunk_nights']} | {item['job_count']} | {item['request_lower_scenario']}–{item['request_upper_scenario']}"
                f" | {item['robots_requests_warm_serial']}/{item['robots_requests_cold_per_job']}"
                f" | {item['conservative_pacing_only_seconds_cold']} |"
            )
    effective = data["estimates"]["effective_today_forward"]
    lines += [
        "", "## Candidate job sizes",
        "These scenarios cover only systems with a validated live sample for every required request type. They use nominal upper request counts and the worst sampled successful response latency, excluding redirects/retries.",
        "The extra 60 seconds below is an assumed startup/persistence allowance, NOT measured overhead. It must be replaced by a real non-production Vercel test.",
        "| Chunk nights | Slowest modeled normal job s | +60s assumed overhead | +240s one retry episode | Untimed systems |",
        "|---:|---:|---:|---:|---|",
    ]
    for item in effective["chunks"]:
        normal = item["slowest_measured_system_job_normal_estimate"]
        if normal is not None:
            lines.append(f"| {item['chunk_nights']} | {normal:.2f} | {normal+60:.2f} | {normal+300:.2f} | {', '.join(item['unmeasured_systems']) or 'none'} |")
    lines += [
        "", "## Vercel decision",
        "- **Single scheduled invocation:** not justified by this sample. Total sweep requests can be large and retries can dominate runtime.",
        "- **Durable small jobs on Vercel:** plausible, not deployment-verified. Start evaluation with 7-night chunks, not 62, and use persistent job state.",
        "- **External batch runner:** remains an alternative if Vercel runtime, access, per-host throttling, or operational requirements fail validation; not selected by this report.",
        "",
        "The actual Vercel plan, Fluid Compute setting, runtime, region, memory limit, and function maxDuration are unknown.",
        "A 300-second function scenario should normally target well below 150 seconds, reserving the rest for cold starts, storage, and variance; this is a planning heuristic, not a guarantee.",
        "The present retry policy can sleep 30 + 120 = 150 seconds for a single request, plus up to three 30-second network attempts. That is not a safe implicit retry budget for every 300-second job.",
        "800-second and beta 1800-second limits are possible only with eligible Vercel configuration; neither has been verified for this account.",
        "",
        "Before selecting Vercel:",
        "1. Validate booking access and response correctness from a non-production Vercel function; a fast 403/challenge/malformed response is not success.",
        "2. Measure cold start, bounded Neon persistence on a separate test branch, and reporting overhead. None was measured against production.",
        "3. Replace the API's in-memory queue/background loops with durable invocation-driven jobs, atomic claims, idempotent result storage, and safe retry delivery.",
        "4. Enforce shared per-host throttling across invocations, particularly all six Südtirol huts on one API host; do not simply launch concurrent chunks.",
        "5. Bound each attempt by an overall deadline and defer long retries to future invocations instead of sleeping through the function budget.",
        "6. Keep Google export separate and resumable; the current Google auth adapter depends on Replit.",
        "",
        "## References",
        "- https://vercel.com/docs/functions/configuring-functions/duration",
        "- https://vercel.com/docs/functions/limitations",
        "- https://vercel.com/docs/queues",
        "",
        "Raw JSON contains request-level status, timing, response size, CPU, local startup cost, and modeled per-job counts.",
    ]
    return "\n".join(lines) + "\n"
