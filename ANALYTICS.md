# Visitor attribution and funnel analytics

This template records a small, privacy-conscious event set so reports can connect
how a visitor arrived with the actions they took. It supports GA4, optional
Vercel Runtime Logs/Log Drains, or both. Neither destination is required.

## Choose a funnel

Choose the profile that matches the site's primary outcome:

| Profile | Funnel stages | Use when |
| --- | --- | --- |
| `ticketing` | `page_view` → `ticket_select` → `date_pick` → `checkout_start` → `purchase_confirmed` | Visitors choose tickets and dates, then buy |
| `lead_generation` | `page_view` → `quote_request_started` → `quote_request_submitted` (or `email_signup_started` → `email_signup_confirmed`) | Visitors request a quote or subscribe |
| `custom` | Defined by the site owner | A site has a different or mixed primary outcome |

Set `SITE.analytics.funnelProfile` in `src/config/site.ts`. The profile is a
reporting convention, not a claim that every stage is implemented. In
particular, this demo has no real payment, quote, or email-signup backend.
`purchase_confirmed`, `quote_request_submitted`, and
`email_signup_confirmed` are server-confirmed outcomes: never emit them from a
button click or browser redirect.

## What this template captures

Each event has a unique `event_id`, event name and timestamp, a random
session-scoped `session_id`, a query-free route path, a small allowlisted
property map, and session-touch / first-touch / latest non-direct attribution.

At the first page load, the attribution parser records:

- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_term`
  when present and safe to retain;
- the external referrer **domain** only, when available;
- the landing path and timestamp;
- `source_method`: `utm` when at least one valid UTM value exists, otherwise
  `referrer` for an external referrer, otherwise `unknown`;
- `ai_source` and `ai_evidence`, kept separate from the source method.

UTM values take precedence over a referrer when choosing `source_method`.
In the GA4 adapter, `session_source_method` describes the current session's
landing touch, while `source_method` describes the latest non-direct touch
retained for attribution.
Known AI referrers (ChatGPT/OpenAI, Perplexity, Gemini, Claude, and Copilot)
and recognizable AI UTM sources receive an `ai_source` label. Other sources
remain `not_ai`. This is evidence-based attribution, not a claim that every
visit from an AI domain was a human visitor. Vercel log records use
`actor_type: crawler` for a short known-crawler user-agent list and
`actor_type: unclassified` otherwise; the template never labels an event as
human based on missing crawler evidence.

The event envelope retains the current session's landing touch alongside the
first touch and latest non-direct touch. This lets reports distinguish a
direct session from the earlier non-direct source that may still receive
conversion credit.

Route page views come from Wouter navigation, including direct loads. Changes
to only the query string or hash do not create another page view. Query strings
and hashes are excluded from paths and GA4 `page_location`; raw URLs, cookies,
IP addresses, and personal details are not included in the event payload.
UTM/property values that resemble email addresses or phone numbers are omitted
or rejected. Do not put personal data in campaign tags.

Attribution persistence is configurable:

- `none`: keep attribution in memory for the current page only;
- `session`: keep it in session storage (the default);
- `first-touch`: keep first-touch and latest non-direct touches in local
  storage for `retentionDays` (default 30).

Session IDs are random and held in session storage. They are not account or
order identifiers. GA4 and Vercel audit records share `site_event_id` /
`event_id` and `site_session_id` / `sessionId` so an operator can reconcile
records. Deduplicate Vercel logs by `event_id`; do not register event or
session IDs as GA4 custom dimensions because of their high cardinality. The
GA4 adapter uses `site_session_id` rather than overriding GA4's own
`session_id`.

## Consent and privacy setup

`SITE.analytics.consent.required` defaults to `true`. No consent banner or
consent-management platform is included in this template. Until a CMP or
equivalent consent UI calls `setAnalyticsConsent(true)` from
`src/lib/analytics/client.ts`, this app does not initialize GA4, save
attribution/session storage, or send analytics events. On withdrawal, the
client stops tracking and removes its attribution/session values.

Before enabling analytics, connect the consent action in the selected CMP to
`setAnalyticsConsent(true)` and its rejection/withdrawal action to
`setAnalyticsConsent(false)`. Ensure the site's consent text and legal basis
match the providers and retention settings actually selected. If a project
uses a different consent design, update the required-consent behavior
deliberately; do not simply remove the gate to make reports populate.

## Choose destinations

### GA4 only

1. Put the site's measurement ID in `SITE.ga4Id` in `src/config/site.ts`.
2. Keep `SITE.analytics.destinations.ga4: true`.
3. Keep `SITE.analytics.destinations.vercelAudit: false`.
4. Connect consent as described above.

The app sends custom event parameters such as `source_method`, the five UTM
values, `referrer_domain`, `landing_path`, and `ai_source`. Register the
parameters needed for reports as GA4 custom dimensions. Since the page URL is
deliberately stripped of its query string, do not assume GA4's built-in
campaign reports will use these custom parameters automatically; validate
acquisition reports in the target GA4 property.

### Vercel audit logs only or alongside GA4

The optional `src/app/api/analytics-event/route.ts` Next.js route writes one JSON line per
accepted event to Vercel Runtime Logs, which can be routed through a Vercel Log
Drain. It is off unless **both** of these are true:

1. Set `SITE.analytics.destinations.vercelAudit: true` and select the exact
   event names to audit in `auditEventNames`.
2. Set the Vercel environment variable `VERCEL_AUDIT_LOGGING_ENABLED=true`
   for the intended deployment environment, then redeploy.

In the Vercel project, configure a Runtime Logs drain to the chosen log
destination and filter/query for `log_type=visitor_analytics_event`. Check the
destination's retention, access, and data-processing rules before enabling it.
Every audited browser event makes an additional function request; consider
volume, latency, and provider costs for high-traffic sites. This template does
not implement a warehouse, dashboard, delivery retry queue, or reporting
pipeline.

The function accepts only the configured client-event allowlist, same-origin
JSON POSTs, and payloads under 4 KB. Its schema rejects server-only conversion
events and unsafe property names/values. It does not treat same-origin checks
as authentication. The log record contains deployment environment/ID,
`actor_type`, and the validated event; it does not log request headers,
cookies, IPs, raw URLs, or server-side order outcomes. Vercel may separately
retain platform request/runtime metadata according to its own settings.

The default build has audit logging disabled. The endpoint is available through
Next.js locally and on Vercel, but returns 404 unless both opt-ins are enabled.

## Event catalog and evidence

| Event | Emitted from | Meaning |
| --- | --- | --- |
| `page_view` | Next.js pathname change | A distinct pathname was viewed |
| `ticket_select` | Ticket quantity control | The selected ticket type/audience quantity changed |
| `date_pick` | Calendar date selection | A visit date was selected |
| `checkout_start` | Schedule continue action | The visitor began the current demo checkout handoff; not a purchase |
| `quote_request_started` | Implement when a quote form is added | A visitor began a quote request |
| `email_signup_started` | Implement when signup UI is added | A visitor began an email signup |
| `checkout_created` | Server only, future integration | A checkout was created by the authoritative checkout backend |
| `purchase_confirmed` | Server only, future integration | A verified payment provider callback confirmed payment |
| `checkout_failed` | Server only, future integration | The checkout backend confirmed a failure |
| `quote_request_submitted` | Server only, future integration | The backend accepted a quote request |
| `email_signup_confirmed` | Server only, future integration | The backend confirmed the signup |
| `cta_click` | Existing `data-track` controls | Generic CTA label for lightweight interaction analysis |
| `faq_open` | Add where FAQ expansion is instrumented | A FAQ answer was opened |

Do not send names, email addresses, phone numbers, message bodies, order IDs,
payment details, or account IDs as event properties. Do not use client-side
`purchase_confirmed` as a workaround for a missing payment integration.

## Reconstructing a report

For either destination, reconcile matching events with GA4 `site_event_id` and
Vercel `event_id`; connect session events with GA4 `site_session_id` and Vercel
`sessionId`. Deduplicate Vercel logs by `event_id`. Keep the exact received
event timestamp, route path, attribution fields, event name, and safe event
properties. For Vercel logs, separate `actor_type=crawler` from
`actor_type=unclassified`; the latter is not proof of a human visit. Compare
AI attribution only when `ai_source` has `ai_evidence=utm` or `referrer`, and
keep those evidence levels visible in reports.

For an end-to-end ticket conversion report, join client-side progression to a
future authoritative server event using a provider-generated checkout
reference that has been reviewed for privacy and security. Do not join by
email, raw URL, or a browser-generated claim of payment. This template does
not yet have the backend/provider integration needed to confirm purchases.

## Adaptation checklist for each new site

1. Select `ticketing`, `lead_generation`, or `custom`; document the site's real
   start and completion evidence.
2. Confirm which events the UI can truthfully emit and which outcomes require
   a backend/provider confirmation.
3. Choose GA4, Vercel audit logs, or both; configure the relevant destination
   and consent integration.
4. Keep event properties allowlisted and free of personal data.
5. Test direct landings with UTMs, external referrers, direct/unknown visits,
   SPA navigation, query/hash-only changes, consent denial/withdrawal, and
   crawler-classified Vercel requests.
6. Verify deduplication and attribution reconstruction in the actual report
   destination before launch.
