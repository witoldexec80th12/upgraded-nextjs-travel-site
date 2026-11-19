# Bukly availability repair

The dispatcher still uses `system=bukly` and the existing `{"sub": "..."}`
configuration. No database migration, production reseed, or scheduler change is
needed for the three existing huts.

## Engines and search

- Prefer a public GET to `/booking?checkin=...&checkout=...&rooms=...`.
- Parse Inertia's public `data-page` JSON, supporting both the original escaped
  HTML attribute and the current JSON script element. No JavaScript browser or
  X-Inertia API/version header is needed.
- **Actual offers are `props.allocations`.** The similarly named
  `props.bookingEngine.allocations` can be an empty default even when offers
  exist. Never use that default as an empty search result.
- Validate the confirmed dates, guests, hut identity, component, calendar window,
  and inventory structure before interpreting availability.
- If `/booking` returns 404, retain the old HTML-route fallback. Never use that
  fallback to evade 401/403, challenge pages, or another HTTP failure.
- Unknown app shells, invalid JSON, and incomplete results are errors, not full.

## Meaning of results

The user's availability results guide is the interpretation contract. In
particular, “available” can mean the group is split across rooms; it does not
mean an exact total of beds left or that everyone sleeps together.

For the newer engine:

- Each guest layout is a partition of the group, such as `4`, `2|2`, or
  `1|1|1|1`. Common layouts are tried first, then other partitions.
- At most six layouts are searched per night. If more remain and none of the
  tried layouts confirms the whole group, the result is `error`, not a false
  `full`. For groups up to four, all partitions fit within this cap.
- A bed-sold plan consumes the number of guests;
  a private-room plan consumes one room. Both room-level and rate-plan-level
  pools are shared across requests, so alternative board/rate plans cannot
  duplicate the same physical room.
- The current private-room JSON uses `total_guests=1` for a two-person room
  quote. It is not the room's capacity. For private rooms, require the confirmed
  room-match hint; non-matching private-room alternatives remain unconfirmed.
- Live bed-sold offers were visibly selectable despite `isCompatible=false`.
  That hint must not suppress valid bed rates: confirmed rate-plan guest
  quantity and the bed pool establish their fit.
- A confirmed full-group fit gives `available`, with `beds_free=null` so the
  existing UI cannot mislabel the queried group size as total beds left.
  The confirmed group size is stored as `people` in the JSON detail alongside
  `count_type=yes_no`.
- `partial` is emitted only after every group partition has been checked and a
  smaller group fit has been verified. Its count is a lower bound.
- `full` means no compatible offer in the exhaustively checked layouts for the
  exact **one-night query**. It may still hide a minimum-stay rule; do not claim
  that every physical bed is sold out.
- Calendar non-arrival dates and dates outside the published window give
  `closed`, including not-yet-open/blocked dates. They are not proof of sold out.
  Later closed dates can be skipped using the same property calendar.
- A restricted next-day departure is an explicit error with an explanatory
  detail; a minimum stay is not invented without evidence.
- Package-only, unsupported, inconsistent, or globally restricted results remain
  unconfirmed errors unless a separate valid room fit establishes availability.

The existing string `detail` contains JSON with `engine_version`, `count_type`,
and a reason or confirmed layout. This preserves the current schema:
`yes_no` for the newer engine's available/full/closed states, `lower_bound` for
partial evidence. New dedicated database columns and the guide's proposed
room-unit table are intentionally outside this repair.

The legacy HTML fallback labels counts as `estimate`, deduplicates common
board-plan variants, and handles named single/double/triple/quadruple rooms.
Unknown private-room capacities require explicit configuration rather than
silently assuming one bed. Legacy titles remain imperfect identity evidence:
per-hut room mappings should be validated before relying on legacy estimates.

## Verification and production safety

On November 10, 2026, an isolated live check of June 4–5, 2027 for two adults
returned:

| Hut | Status | Checker elapsed time | Requests including robots |
|---|---|---:|---:|
| Scotoni | available | 2.51 s | 2 |
| Col Gallina | closed by calendar | 2.41 s | 2 |
| Averau | closed by calendar | 2.38 s | 2 |

These are single samples, not seasonal coverage or repeatability statistics.
“Closed” does not establish whether the cause is season, unloaded inventory,
or a full block. No stay longer than one night was inferred. Raw measurements:
`generated-artifacts/bukly-repair/checker-verification.json`.

Tests use synthetic payloads shaped from observed public responses, not copied
guest/session data. The offline tests forbid real network calls and cover
both engines, shared inventory, split rooms, bounded layouts, malformed pages,
calendar windows, count interpretation, and denied access.

Run the focused suites with production credentials removed:

```bash
env -u DATABASE_URL -u ADMIN_API_KEY -u SESSION_SECRET \
  -u AIRTABLE_API_KEY -u AIRTABLE_BASE_ID -u GITHUB_TOKEN \
  uv run --no-sync python -m unittest discover -s tests -p 'test_bukly.py' -v
```

Use the isolated benchmark for authorized, bounded live checks. A fixture-based
benchmark is not a real provider-performance measurement. Its request-count
model now allows up to six Bukly layouts/night; older audit/benchmark reports
are historical snapshots.

Do not restart the production-connected API merely to benchmark: startup can
restore queued jobs and write to Neon. No production records, exports, schedules,
or deployment were changed during this repair. The existing API process must
load the new code through a deliberate restart/deployment when appropriate.
