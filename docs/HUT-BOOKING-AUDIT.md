# Hut booking-site audit

**Checked: November 10, 2026. Scope: all 26 active huts in the checked-in inventory.**

Subsequent code repair: see [the Bukly checker notes](BUKLY-CHECKER.md). The
assessments below preserve what the audit observed before that repair.

This is a booking-channel and automation-readiness audit, **not a scan of
availability for particular stay dates**. “Manual,” “blocked,” and “unverified”
must never be exported as “sold out.” Loading a page successfully does not prove
its date-query API or our checker works.

## Findings that change the proposed daily schedule

- Keep the four existing checker families, but do not enable them all as if
  coverage had been verified.
- **Six Südtirol huts:** their public sites link to, or embed, Booking Südtirol.
  The common availability API's current robots policy is `User-agent: *` /
  `Disallow: /`. Our robots-respecting scraper cannot query it. An approved
  access route or permission is needed, not a different user-agent or proxy.
- **Three Bukly huts:** the stored `/en-us` landing pages returned HTTP 404 in
  this environment. Current root URLs resolve to `/booking`, which returns a
  JavaScript app shell without a server-rendered calendar or search form. This
  explains why the old HTML checker needs revalidation. It does **not** yet
  establish that Playwright is necessary: first inspect the permitted data API.
- **Foundation:** existing pages for Lagazuoi, Staulanza, Coldai and Carestiato
  are recognizable. **Croda da Lago also has a live Foundation-style calendar
  and initial search form**, despite being marked manual in the seed.
  Coldai's English entry page works and exposes an English search action; its
  configured Italian calendar URL timed out once. Do not describe that timeout
  as proof that the URL is invalid.
- **Dibona:** `/robots.txt` on the configured www host returned HTML instead of
  a usable robots policy. The conservative audit stopped before fetching its
  booking page/API. Historical closed-date benchmark results do not establish
  current policy compliance or readiness.
- **Two additional families:** Planyo (Biella), and VikBooking (Nuvolau and
  Città di Fiume). Neither has a checker in this project yet. Plugin presence
  alone does not prove the full date-query workflow.
- **Nuvolau:** the official page explicitly says 2027 reservations start in
  January 2027, with planned opening June 20–September 20, 2027. Its form page
  says rooms are closed. This is not a sold-out response. The site also states
  that bookings made by agencies are not accepted; consider that restriction
  separately from technical availability checking.
- **Cinque Torri:** the booking buttons lead to a rooms-information page saying
  summer 2027 is almost booked and further requests may receive a reply only
  if places remain. That is a general notice, not proof that every date is full.

## Complete inventory

“Existing checker” below means code exists, not that an end-to-end stay-date
check was performed during this audit. Search forms were inspected but never
submitted.

| Key | Hut | Observed booking family | Audit assessment | Evidence page | Next action |
|---|---|---|---|---|---|
| fodara | Rifugio Fodara Vedla | Südtirol | Official site links to Booking Südtirol; shared API policy disallows crawling. | [Official site](https://www.fodara.it/en) | Obtain approved access before enabling automatic checks. |
| pederue | Pederü Berggasthaus | Südtirol | Official page names the booking provider; some partner links are malformed; shared API policy disallows crawling. | [Official site](https://www.pederue.it/en) | Confirm the correct provider link and approved API access. |
| biella | Rifugio Biella | Planyo | Public Planyo page identifies Rifugio Biella; no project checker exists. | [Booking page](https://www.planyo.com/booking/Rifugio-Biella) | Investigate permitted read-only calendar access and add a separate adapter if viable. |
| sennes | Rifugio Sennes | Direct request | Arrival/departure inquiry form; no live availability result found on the inspected page. | [Contact/request page](https://sennes.com/en/contact/index.php) | Keep request-based/manual unless the hut supplies a calendar or feed. |
| fanes | Ücia Fanes-Hütte | Südtirol | Booking Südtirol widget and provider link observed; shared API policy disallows crawling. | [Booking page](https://www.rifugiofanes.com/prenota) | Obtain approved access before enabling automatic checks. |
| lavarella | Rifugio Lavarella | Südtirol | Booking Südtirol widget script observed; shared API policy disallows crawling. | [Booking page](https://lavarella.it/en/book-online) | Obtain approved access; retain the seed's bed-by-bed caveat for later validation. |
| muntagnoles | Ücia dles Muntagnoles | Direct request | Official page asks for a request by form or email; no live calendar found. | [Reservation information](https://www.muntagnoles.com/index.php/it/info-prenotazioni) | Keep manual/request-based; do not infer beds from inquiry acceptance. |
| scotoni | Rifugio Scotoni | Bukly | Stored English landing path returned 404; current official booking link returns a JavaScript shell. | [Current booking entry](https://scotoni.bukly.com/booking) | Revalidate the permitted API and checker; do not parse the shell as full. |
| lagazuoi | Rifugio Lagazuoi | Foundation | Canonical calendar page and initial search form are present; existing checker family. | [Calendar](https://rifugiolagazuoi.com/IT/disponibilita.php) | Validate useful stay-date responses and account for canonical redirects. |
| colgallina | Rifugio Col Gallina | Bukly | Stored English landing path returned 404; root resolves to the JavaScript booking shell. | [Current booking entry](https://rifugiocolgallina.bukly.com/) | Revalidate the permitted API and checker. |
| dibona | Rifugio Angelo Dibona | Dibona app (seed mapping) | Configured host's robots URL returned HTML; policy and current workflow remain unverified. | [Configured booking host](https://www.rifugiodibona.app/) | Clarify robots policy or approved access before enabling daily checks. |
| giussani | Rifugio Camillo Giussani | Direct contact | Reservation/deposit instructions and direct contact, with no public live calendar found. | [Reservation information](https://www.rifugiogiussani.com/prenotazioni/) | Keep manual/direct contact. |
| valparola | Rifugio Passo Valparola | Unconfirmed / direct request | Seed has no booking URL; a third-party MountBED listing offers a contact request, not live inventory. | [Third-party listing](https://www.mountbed.com/en/99/rifugio-valparola/schelter-website) | Confirm the official reservation channel with the hut; do not claim a calendar is unavailable everywhere. |
| sassdlacia | Camping Sass Dlacia | Südtirol | Booking Südtirol widget observed; shared API policy disallows crawling. | [Booking page](https://campingsassdlacia.it/en/booking) | Obtain approved access; later distinguish pitches from accommodation/bed inventory. |
| armentarola | Hotel Armentarola | Südtirol | Booking Südtirol widget/provider link observed; shared API policy disallows crawling. | [Booking page](https://www.armentarola.com/en/book) | Obtain approved access before enabling automatic checks. |
| sassodistria | Hotel Al Sasso di Stria | Vertical Booking | Provider link/form confirmed on the official site; booking engine not probed under the existing no-scrape restriction. | [Official site](https://alsassodistria.it/it/) | Keep excluded/manual unless a permitted provider integration becomes available. |
| ciasasalares | Ciasa Salares | Vertical Booking | Provider links confirmed on the official site; booking engine not probed under the existing no-scrape restriction. | [Official site](https://www.ciasasalares.it/it/) | Keep excluded/manual unless a permitted provider integration becomes available. |
| averau | Rifugio Averau | Bukly | Stored English landing path returned 404; officially linked root resolves to the JavaScript booking shell. | [Current booking entry](https://rifugioaverau.bukly.com/) | Revalidate the permitted API and checker. |
| scoiattoli | Rifugio Scoiattoli | Custom form | Public arrival/departure and guest-count form exists; it was not submitted, so its results and semantics are unverified. | [Booking form](https://www.rifugioscoiattoli.it/booking/) | Investigate the read-only search step before deciding whether a custom adapter is feasible. |
| 5torri | Rifugio Cinque Torri | Direct contact / rooms page | Booking buttons lead to room information, not an observed calendar; summer 2027 near-full notice is not per-date availability. | [Rooms/booking information](https://www.rifugio5torri.it/en/rooms.html) | Keep manual; preserve the published notice separately from date-level status. |
| nuvolau | Rifugio Nuvolau | VikBooking | Plugin observed on the form page; booking is currently closed and 2027 reservations explicitly start in January 2027. | [Booking information](https://rifugionuvolau.it/en/booking/) | Record not-yet-open separately; investigate this adapter when booking opens and respect booking restrictions. |
| crodadalago | Croda da Lago / Palmieri | Foundation | Live calendar contains TabDisp and a POST search form with arrival, departure and people fields; seed's manual label is outdated. | [Live calendar](https://www.crodadalago.it/Booking/IT/disponibilita.php) | Add and fixture-test Foundation configuration before any production inventory change. |
| cittadifiume | Rifugio Città di Fiume | VikBooking; WP Booking Calendar also present | English page exposes a VikBooking date/bed search form; both plugin families are loaded. | [Online booking page](https://rifugiocittadifiume.it/en/book-online/) | Identify the authoritative availability source and implement a separate read-only adapter. |
| staulanza | Rifugio Passo Staulanza | Foundation | Calendar page and initial search form are present; existing checker family. | [Calendar](https://www.staulanza.it/Booking/IT/disponibilita.php) | Validate useful stay-date responses before scheduling. |
| coldai | Rifugio Coldai | Foundation | English entry page/calendar works and points to an English search action; the configured Italian calendar request timed out once. | [English booking entry](https://rifugiocoldai.com/Booking/index_en.php) | Validate the configured language paths; do not treat a timeout as sold out or as a proven missing URL. |
| carestiato | Rifugio Carestiato | Foundation | Configured calendar page is reachable and contains TabDisp plus the expected search fields. | [Calendar](https://www.rifugiocarestiato.com/Booking/IT/disponibilita.php) | Validate useful stay-date responses before scheduling. |

## Access evidence and limitations

- Südtirol policy source:
  https://api.widgets.bookingsuedtirol.com/robots.txt
  The parsed policy disallowed the existing `/v6/properties/.../availabilities`
  route. No availability request was sent to it.
- The official Scotoni site linked to `/booking`; Col Gallina's official contact
  page still linked to the English path that failed in this environment;
  Averau's official homepage linked to the root:
  https://www.scotoni.it/it/,
  https://www.rifugiocolgallina.com/en/contacts-col-gallina-rifugio/,
  https://www.rifugioaverau.it/.
  Search results still show older Bukly pages with calendar text, but **current
  direct responses** were used for the route/shell findings.
- Nuvolau plugin evidence:
  https://rifugionuvolau.it/en/booking-form/.
- Public GETs were paced, checked against robots, capped at 2 MB per response,
  and used explicit time/request limits. No forms, date searches, reservation
  steps, payment steps, or authenticated areas were submitted/accessed.
- This audit issued **83 direct HTTP requests**, including robots checks and
  redirects, plus separate public web-search/fetch verification. No browser
  automation or bot-challenge bypass was used.
- A missing calendar on one inspected page is not proof that no calendar exists.
  Timeouts and unverified policies remain explicit uncertainties.
- No production database, Airtable, Google Sheets, hut seed/configuration,
  checker, cron schedule, or deployment was changed.

## Recommended implementation order

1. Repair/revalidate Bukly's current booking workflow, and validate Foundation
   paths, response semantics and useful open-season dates.
2. Add Croda da Lago through the existing Foundation family after fixture tests.
3. Resolve approved Südtirol access and Dibona policy uncertainty. Keep these
   groups visibly blocked/unverified until resolved.
4. Assess separate Planyo and VikBooking adapters; keep unsupported huts manual.
5. Only then wire provider-grouped, resumable daily jobs to the agreed schedule.

The requested broad daily exports remain separate from admin-triggered Airtable
checks. This audit does not create or enable either job type.

Detailed raw evidence and the downloadable CSV are under the ignored directory
`generated-artifacts/hut-site-audit/`; this summary is versioned.
