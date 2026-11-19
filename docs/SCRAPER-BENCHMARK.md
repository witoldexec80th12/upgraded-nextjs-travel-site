# Measuring scraper performance

See [the initial live findings](SCRAPER-BENCHMARK-RESULTS.md) for the November 10,
2026 measurements and their limitations.

The benchmark is separate from the FastAPI application. It invokes the existing
checkers directly and does not import the app, runner, database, scheduler, or
export routines. Child processes receive an allowlist of runtime settings, not
database, admin, Airtable, or Google credentials.

**The workspace DATABASE_URL is production Neon. Do not use normal admin checks,
the production worker, application startup, or database-writing tests as a
benchmark.** The commands below need no database.

## Offline verification

```bash
env -u DATABASE_URL -u ADMIN_API_KEY -u SESSION_SECRET \
  -u AIRTABLE_API_KEY -u AIRTABLE_BASE_ID \
  uv run --no-sync python -m unittest discover -s tests \
  -p 'test_scraper_benchmark.py' -v

uv run --no-sync python -m hut_availability.benchmark \
  --max-requests 60 --max-seconds 180 --case-seconds 45 \
  --sample-start 2027-06-28
```

The default is deterministic offline responses and a **virtual clock**. Those
times test instrumentation and are not real hosting-performance measurements.
The cases cover available and sold-out responses, unknown HTML/JSON, access
denials, robots denials, timeouts, retries, canonical redirects, and budget limits.

## Explicit, bounded live measurement

After authorizing the small public availability queries:

```bash
uv run --no-sync python -m hut_availability.benchmark --live \
  --max-requests 60 --max-seconds 180 --case-seconds 45 \
  --sample-start 2027-06-28
```

Both total budgets are required for live mode. Each selected hut gets a one-night
case, then a seven-night case only if the baseline returned structurally valid
availability. Select a future start date whose seven nights cross a month
boundary. Use `--huts fodara scotoni lagazuoi dibona` to restrict the representatives.
Larger date ranges are not launched by this CLI.

Each case is an isolated process with a real deadline and a parent-process kill
fallback. The request budget includes robots checks, retries, and redirects.
The response-size cap is 2 MB. Production pacing is retained with a two-second
floor and site crawl delays; long required backoffs stop the case if they do not
fit the remaining budget. A stopped case is not reported as a successful fast scan.
Canonical www/non-www redirects require policy checks and allowlisted endpoints;
other cross-site redirects are not followed.

Only read-only availability endpoints are permitted. The Foundation checker's
POST is restricted to its existing initial availability-search endpoint, not a
reservation/payment endpoint. No actual booking is created. No raw response
bodies, cookies, credentials, or query strings are saved.

## Results and interpretation

Each invocation writes `results-live.json` / `report-live.md` (or `fixture`
equivalents) into ignored `generated-artifacts/scraper-benchmark/`.
Choose a different child directory with `--output-dir` to preserve earlier runs.
The JSON contains request-level status, bytes, network time, wait/backoff time,
checker/validation residual, CPU, process peak RSS, and local startup overhead.
It also estimates 7-, 14-, 31-, and 62-night batches.

The request model uses the checked-in active inventory and CLI date-window
defaults, not production settings. It distinguishes all configured dates from
the current Europe/Madrid date forward. Monthly calendar requests repeat at
chunk boundaries. Nominal counts exclude retries and redirects, and canonical
redirects can add robots checks; consult the raw attempts for these extras.
A closed Foundation calendar does not validate the latency of its nightly search
endpoint, so its upper-job timing remains unmeasured until that request type is
sampled. All six Südtirol huts share one host: separate functions
must not independently multiply the permitted request rate.

The default full reference window is June 2026 through October 2027. Override
`--window-start`, `--window-end`, and `--as-of` for other modeled workloads.
Empty/out-of-season/closed responses are distinct from confirmed available
beds. A seven-night sample is not evidence of full-season correctness.

To combine saved runs without any HTTP requests:

```bash
uv run --no-sync python -m hut_availability.benchmark \
  --combine-results \
    generated-artifacts/scraper-benchmark/results-live.json \
    generated-artifacts/scraper-benchmark/canonical-recheck/results-live.json \
  --output-dir generated-artifacts/scraper-benchmark/combined \
  --max-requests 60 --max-seconds 180 --case-seconds 45 \
  --sample-start 2027-06-28
```

## Vercel qualification

No Vercel account configuration or isolated Vercel benchmark deployment was
provided for the initial measurement. Local CPU, memory, network results, and
process startup are **not Vercel measurements**.

Current published Fluid Compute limits list Hobby at 300 seconds and Pro /
Enterprise at up to 800 seconds, with an eligible extended-duration beta up to
1800 seconds. These are comparison scenarios, not this account's verified limits.
Confirm runtime, Fluid Compute, region, memory, and maxDuration in the target
project before making a hosting decision.

A real proof should run a bounded authenticated job on a non-production Vercel
deployment and, if measuring persistence, a separate Neon test branch. It should
measure startup and storage overhead, validate the returned availability, and
enforce a shared per-host request limit. Never use production Neon for this test.

The existing 30- and 120-second retry sleeps alone can add 150 seconds per
failing request; serverless jobs need an overall deadline and delayed durable
retries. A full daily sweep need not fit in one invocation, but the present
in-memory queue and API-started worker cannot simply be left running after a
function returns. Durable jobs, safe claims, idempotent storage, and resumable
exports are required before a serverless migration.

References:
- https://vercel.com/docs/functions/configuring-functions/duration
- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/queues
