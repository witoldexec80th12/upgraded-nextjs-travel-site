# Initial live benchmark findings

Measured on November 10, 2026, in isolated processes in the Replit development
environment. **This is not a Vercel deployment benchmark.**

## Scope and safeguards

- Two people; one-night baseline and seven nights beginning June 28, 2027.
- Seven-night cases cross into July; no full-season live sweep.
- The initial run and a narrow canonical-redirect recheck together used
  **27 wire requests** and **40.02 seconds** of summed suite wall time, within
  the approved cumulative cap of 60 requests / 180 seconds.
- All live requests were GET requests. No booking submissions, production Neon
  access, API startup, worker restart, Airtable calls, or Google Sheets calls.
- A denied or unsuccessful baseline skipped the corresponding seven-night case.
- The recheck accepted only canonical www/non-www redirects with robots-policy
  checks. It did not bypass the robots denial or follow unrelated paths.

## Observations

| Representative system | Case | Observation |
|---|---|---|
| Dibona | 1 night | 2.48 s; explicit API closed-date response |
| Dibona | 7 nights | **14.37 s**, 8 requests including robots, **40.14 MiB** peak process RSS |
| Foundation / Lagazuoi | 1 night after canonical redirect support | 4.47 s; recognized closed calendar |
| Foundation / Lagazuoi | 7 nights after canonical redirect support | **6.35 s**, 6 requests including redirects/policies, **43.62 MiB** peak process RSS |
| Südtirol / Fodara | 1 night | Requested availability URL disallowed by robots policy; no availability request sent |
| Bukly / Scotoni | 1 night | Availability request redirected outside the allowlisted availability path; not followed |

The initial conservative harness also stopped Lagazuoi's canonical redirect.
That was a harness restriction, not evidence of a blocked provider, and prompted
the narrowly scoped recheck. Keep the initial and recheck raw files separate.

There is only one successful sample per hut/range. No p95, repeatability, or
production reliability conclusion is supported. All validated live samples
returned **closed** dates; no bookable-bed response was measured. Future-season
dates can be unopened. The Foundation nightly search endpoint was not exercised
by these closed calendars, so its full upper-job runtime is still unmeasured.

## Workload model

The checked-in inventory has 14 automated huts across four systems and 12
manual-only huts. The reference default window has 518 nights. The effective
today-forward window on the measurement date has 356 nights.

| Chunk nights | Full-window jobs | Today-forward jobs |
|---:|---:|---:|
| 7 | 1,036 | 714 |
| 14 | 518 | 364 |
| 31 | 238 | 168 |
| 62 | 126 | 84 |

These are modeled per-hut chunks, not measured live full sweeps. Smaller chunks
repeat monthly requests and cold robots checks. Raw JSON includes logical
request counts with calendar/grid shortcut scenarios; those counts exclude
redirects and retries. Nominal robots counts exclude additional canonical hosts.
Production settings were not read: the model uses checked-in defaults.

For Dibona's measured request type, conservative normal-response estimates for
7/14/31/62-night cold jobs are approximately **20/37/79/156 seconds**, before
unmeasured Vercel startup, storage, or reporting overhead. These estimates use
two seconds plus the worst sampled successful response time per nominal request.
They do not extrapolate a failed or denied response as a fast success.

## Vercel decision

**Small durable Vercel jobs are plausible; an all-Vercel deployment is not yet
verified.** A whole-sweep single invocation is not justified by this evidence.
Start a proof with 7- or 14-night per-night-query jobs, then tune by engine.
Monthly engines may support larger calendar-aligned chunks once their full
response paths have been measured and validated.

The Vercel account plan, runtime settings, function duration, memory, and region
were not supplied. Published Fluid Compute limits provide 300-second, eligible
800-second, and beta 1800-second comparison scenarios, not verified account
configuration.

The current retry policy can spend 150 seconds just sleeping on one failed
request, plus network attempts. That needs a per-invocation deadline and durable
delayed retries. The current API-started worker and in-memory queue must also be
replaced for request-scoped execution. Parallel functions must share host-level
throttling; all six Südtirol huts call the same host.

Before choosing a provider, validate access, useful availability responses,
memory, cold starts, and bounded persistence on an isolated Vercel deployment
using a **separate Neon test branch**. Do not use production Neon for that proof.
An external batch runner remains an alternative, not a requirement established
by these measurements.

## Reproduction and raw evidence

See [the benchmark guide](SCRAPER-BENCHMARK.md).

- Initial raw run: `generated-artifacts/scraper-benchmark/results-live.json`
- Canonical recheck: `generated-artifacts/scraper-benchmark/canonical-recheck/results-live.json`
- Combined raw evidence: `generated-artifacts/scraper-benchmark/combined/results-live.json`
- Detailed report: `generated-artifacts/scraper-benchmark/combined/report-live.md`

Raw and generated outputs are intentionally ignored by Git. This summary and the
benchmark source remain versioned. No Git push or production deployment was made.
