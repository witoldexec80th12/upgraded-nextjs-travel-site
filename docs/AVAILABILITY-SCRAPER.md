# Hut availability operations

The Python FastAPI service owns the scraper, database queue, and daily schedule.
Next.js serves the admin interface; it does not run background scraping jobs.
PostgreSQL remains the source of truth. Airtable and Google Sheets receive
reporting copies.

For isolated, non-writing performance measurements, see
[the scraper benchmark guide](SCRAPER-BENCHMARK.md). Do not benchmark by
starting the normal production-backed worker.

## Database setup

The service connects to PostgreSQL through `DATABASE_URL`. This project now
uses the user's external Neon production database, including from the Replit
workspace. Treat database writes here as production writes: use a separate
development/test database or Neon branch for database-writing tests and experiments.
Replit's built-in database tools and Publish schema synchronization do not
manage this external database.

After confirming the target database and authorizing a production schema change,
apply new schema versions on the same database used by the Python service:

```bash
uv run --no-sync alembic upgrade head
```

For a new database only, load the hut directory with
`uv run --no-sync python -m hut_availability.seed`. The seed command also updates
matching hut records, so it should not be run casually against production.
Changing the secret in Replit does not configure a separate production host:
set its database secret securely on the FastAPI host as well.

This adds a disabled-by-default schedule configuration and daily run records.
It does not remove or rewrite the existing availability history. The default
scan window is June 1, 2026 through October 31, 2027, for two people at 03:00
Europe/Madrid; the admin form lets you change those values.

## Airtable checks started in admin

An operator-selected date-range check is saved to PostgreSQL first. When its
scrape job completes, the service upserts those huts and nights into the
existing `AV1 Availability` Airtable table using the current stable `Key`
mapping. A failed Airtable write does not undo PostgreSQL results. The job page
shows the separate Airtable status and offers a retry without scraping again.
The Python service needs `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, and, if the
table has another name, `AIRTABLE_TABLE`.

## Daily Google Sheets scan

1. Confirm Google Sheets is connected to this Replit project.
2. Open `/admin`, review the date range, group size, local time, and time zone.
3. If no workbook is linked yet, choose **Create Google workbook**. It creates
   one tab per active hut plus Overview. If a workbook is already linked, use
   **Open workbook**; **Refresh hut tabs** only adds missing tabs and dates.
4. For a safe first check, set the Admin date range to no more than seven future
   stay nights and choose **Run one-time pilot**. It checks all automatic huts,
   skips manual-only huts, stores results in PostgreSQL, and then exports them
   to the existing workbook. This action does not save the range or enable the
   recurring schedule. Each row is a one-night stay for the selected group.
5. Review the result in PostgreSQL and the new scan-date column in Sheets. The
   cell shows status and group size, not an unqualified remaining-bed total.
   `AVAILABLE` means the group fits, possibly across rooms; `FULL` means no fit
   for that group and one-night search; `CLOSED` does not necessarily mean sold
   out; `ERROR` means the result is unknown.
6. When the pilot is satisfactory, save the desired future date range and choose
   **Enable daily scan**. Until enabled, the scheduler does not enqueue
   broad scans. You can pause it from the same admin card.
7. The Python service checks the schedule every minute. It creates at most one
   sweep for a local calendar day, resumes queued batches after a restart, and
   catches up once the service is back after its configured run time. Enabling
   it after that time may start today's scan shortly after you save.

Each daily sweep is divided into no more than 62 nights per worker batch. Past
nights remain in the matrix for reference, but a daily run starts at the later
of the configured first night and the current local date. After the configured
last night passes, the scheduler pauses itself instead of scraping old dates
forever.

The queue runs batches serially using the existing read-only hut checkers and
request pacing. The resulting Google Sheets tab has night dates as rows and
local scrape dates as columns. Cells include the status and searched group;
PostgreSQL keeps the full timestamps and checker details. The Admin date range
can be changed for future sweeps. Existing history remains, and past dates are
not backfilled.
The configurable range is capped at 540 nights to stay within Google Sheets'
workbook cell limit.

Huts configured as manual-only are listed in the workbook as “Manual only” and
are not queried or counted as successful automated checks. Check the admin
card for batch progress and partial results. A large sweep may still be
running after its scheduled start time because all batches share the serial
worker.

## Hosting

The Python service must remain running for the schedule and queue to execute.
The Replit development workflow is suitable for testing while the project is
running, but it is not a durable production scheduler. Production needs a
persistent host for FastAPI and PostgreSQL. A Vercel Next.js build alone does
not start Uvicorn or keep a Python worker running; configure the Next.js host's
`AVAILABILITY_API_URL` to reach the separately hosted FastAPI service.

The Google connection uses Replit's connector SDK, which obtains OAuth access
from this Replit project. If the Python worker is moved off Replit, this adapter
will need a supported Google authentication method for that host; do not copy
Google credentials into frontend code or commit them to the repository.
