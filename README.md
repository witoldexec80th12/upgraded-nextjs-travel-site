# Reusable Next.js Site Foundation

A config-driven Next.js App Router website, migrated from the Vite template
without changing its design. Public pages are statically generated as full HTML.
The optional Alta Via hut admin connects to a **separate Python FastAPI service**.

## Run and verify

Requires Node.js 20.9+ (Node 22 LTS recommended) and npm.

```bash
npm ci
npm run dev          # Next.js development server, port 5000
npm run typecheck
npm run build        # compile Markdown/FAQ + metadata files, then Next.js SSG
npm run test:foundation  # inspect build files + fetch HTML from a temporary production server
npm run test:analytics
npm run test:browser # against the running preview; needs Chromium
npm run start        # serve the production build, port 5000
```

`PORT` can override the port. The existing Replit Project workflow also runs the
Python availability service on port 5001. The public site builds without Python,
database access, or admin secrets.

Development intentionally uses Webpack: the default Turbopack development server
failed its HMR connection in this environment and left the static HTML
unhydrated. Production builds use Next.js's default bundler. If changing the
development bundler, verify clicks and navigation in the proxied preview.

## What “static-first” means here

- Home, informational pages, legal pages, FAQs, and article URLs are generated
  during the build using `generateStaticParams`. Their content and navigation
  are present before JavaScript runs.
- Article Markdown, FAQs, and informational/legal content are server components.
  Translation messages arrive with the page rather than loading after mount.
- The homepage ticket selectors, header language menu, booking date picker,
  sticky booking sheet, and admin controls remain interactive client components.
  Client components can still produce HTML on the server.
- Booking and confirmation pages have static shells; query-string-specific
  controls load inside Suspense in the browser. The booking flow is still a
  **demo**: no live ticket inventory, payment, or real confirmation is added.
- The private admin and API bridge are rendered/run on demand. No admin data is
  included in a static build.

The separate scraper service's database, daily schedule, Airtable sync, Google
Sheets setup, and production hosting requirements are documented in
[`docs/AVAILABILITY-SCRAPER.md`](docs/AVAILABILITY-SCRAPER.md).
- Unknown URLs return 404s. Every public page is locale-prefixed, including
  English (`/en`). Old root, schedule, and category-first article URLs redirect
  permanently to their new destinations, preserving query parameters.
- This is a normal Next.js deployment, **not** `output: 'export'`: API routes
  require a Next.js-capable host even though public content is static.

## Start another site from this foundation

1. Copy this repository into a new project/repository. Keep each site's content
   independent rather than sharing a branch of modified client content.
2. Fill out `INTAKE.md`.
3. Edit `src/config/site.ts`: production origin, authority/organization details,
   supported UI locales, navigation, metadata defaults, analytics, feature flags.
   **`SITE.origin` is the single domain setting** used by canonical URLs,
   structured data, sitemap, social images, and language links.
4. Edit `src/content/en/event.ts`: display brand, colors, fonts, hero, tickets,
   location, contact, and event copy. Its old `seo.siteUrl` field is retained for
   content-format compatibility but does not override `SITE.origin`.
5. Replace assets in `public/`. Fonts are self-hosted in `public/fonts/`;
   `npm run fonts` regenerates them. Keep Tailwind scanning limited to `src/`.
6. Replace or remove this project's example articles and FAQ content. See
   `ARTICLES.md` and `FAQ.md`; run `npm run articles` / `npm run faq`.
7. Add localized event configs in `src/content/index.ts` where needed.
   UI messages live at `src/content/<locale>/messages.json`. The original
   13 UI languages and Romanian editorial translations are retained.
   Guides use `/<locale>/guides/<translated-slug>`. Their language links come
   only from real translations in the article registry.
8. If the new site has no hut admin, set `SITE.features.hutAdmin` to `false`.
   Admin pages and the bridge then return 404. Omit the Python workflow,
   `hut_availability/`, its Python dependencies, and its secrets in that new copy
   if they are not needed. Do not remove them from this project inadvertently.
9. Update the legal boilerplate for the actual business and jurisdiction. Some
   legal/editorial text is example content; configuring branding is not a legal
   compliance review or an editorial fact check.
10. Build, run the checks above, and inspect desktop/mobile pages before launch.

### Where things live

| Location | Purpose |
|---|---|
| `src/app/[locale]/` | Explicit public routes and locale layout |
| `src/app/[locale]/tours/[slug]/` | Package detail pages |
| `src/app/[locale]/guides/[slug]/` | Editorial guides, including migrated history articles |
| `src/app/[locale]/booking/[package]/` | Reusable demo booking entry |
| `src/lib/site-pages.ts` | Public route resolution, static paths, brand CSS |
| `src/lib/page-metadata.ts` | Shared Next.js metadata and structured data |
| `src/config/site.ts` | Domain, organization, navigation, languages, defaults |
| `src/content/<locale>/` | Site-specific copy, packages, UI messages, FAQ, guides |
| `src/views/` | Migrated page components, not framework route files |
| `src/components/` | Shared SEO, layout, packages, booking, article, UI |
| `src/i18n/` | UI translations and locale context |
| `src/lib/packages.ts`, `src/lib/schema.ts` | Shared catalog lookup and structured-data helpers |
| `src/app/admin/` | Private admin pages and auth/export bridge |
| `src/lib/availability-proxy.ts` | Same-origin connection to Python |
| `src/app/api/analytics-event/route.ts` | Optional, consent-aware audit endpoint |
| `src/app/sitemap.ts`, `src/app/robots.ts` | Native Next.js metadata routes |
| `scripts/generate-seo-files.ts` | llms.txt generation only |

For a new informational page, add an explicit route beneath the locale layout,
its route inventory entry in `src/lib/site-pages.ts`, and metadata in
`src/lib/page-metadata.ts`. There is no public page-switching catch-all.
Add guides through Markdown; the compiler registers their routes automatically.
The old Vite entry point, Wouter public router, DOM-based SEO hook, and
HTML-tag-only prerender pass have been retired. Admin navigation also uses
Next.js; its query/session state lives in a persistent admin layout.

Browser checks use `playwright-core` and the system Chromium (set `CHROMIUM_PATH`
on machines where it is elsewhere). `TEST_BASE_URL` overrides the target URL.
`npm run test:browser -- --admin-login` additionally checks the live development
admin with the existing `ADMIN_API_KEY`, without printing or saving it. It reads
existing hut/history data, exports CSV, and signs out; it does not start scraping
jobs or modify the database. Browser screenshots stay in ignored
`generated-artifacts/`.

## SEO and analytics

Next.js renders title, description, robots directives, canonical, hreflang,
Open Graph, and Twitter metadata on the server. JSON-LD is emitted with escaped
script content and preserves article editorial schema and homepage ticket
schema. Fully translated articles are self-canonical, with reciprocal hreflang
for indexable translations and English as x-default where available;
fully translated site pages are self-canonical. English fallback content is
marked visibly, carries its content language, is noindex, and canonicalizes to
its English counterpart. Translated UI alone does not qualify a page for
hreflang or the sitemap. The supplied event/FAQ/legal copy remains English.

Next.js serves `/sitemap.xml` and `/robots.txt` through metadata routes.
Do not create conflicting copies in `public/`. Build/dev regenerate only
`public/llms.txt`. Booking, confirmation, fallback, and admin pages are
noindex; admin/API paths are excluded from crawler discovery. See
`docs/SEO-GEO-PLAYBOOK.md` for the original strategy and `ANALYTICS.md` for the
consent-aware event catalog. Analytics remains opt-in/disabled unless configured.

### Add a package, guide, or locale

- **Package:** add a typed record to `src/content/en/packages.ts`. Choose a unique,
  URL-safe `slug` and unique ticket IDs, and supply title, description, image,
  tickets/prices, and `contentLocale`. The tour and booking routes, metadata,
  and static paths use this catalog. No route code needs to be copied. The
  existing `castle-tickets` collection is sample data, not hiking inventory.
  Set `SITE.defaultPackage` to the collection used by the homepage and sticky
  CTA. Those controls, booking summaries, and homepage offer schema all consume
  the same catalog ticket tiers; a missing default package fails explicitly.
- **Guide:** create `src/content/en/guides/<category>/<stable-english-slug>.md`
  using an existing guide as a frontmatter example. Translations use the same
  category and stable filename under their own locale folder, with their own
  translated frontmatter `slug`. Run `npm run articles`; never edit generated
  `src/data/articles/` or `src/lib/article-routes.ts`.
- **Locale:** register its code in `SITE.supportedLocales` for UI or
  `SITE.contentLocales` for editorial-only coverage. Add messages and register
  them in `src/i18n/messages.ts`. For genuinely translated site copy, add a
  locale event config and register it in `src/content/index.ts`. For translated
  packages, add a locale catalog and register it in `src/lib/packages.ts`,
  preserving stable package slugs and ticket IDs. Untranslated packages fall
  back individually. Put FAQ Markdown at `src/content/<locale>/faq.md`.
- **Compatibility:** legacy URL mappings live in `src/lib/legacy-redirects.ts`
  and the generated article redirect registry. Test before changing public
  URLs; the previous `/en` → `/` rule must not be restored.

After `npm run build`, `npm run test:foundation` automatically starts a temporary
production `next start` server on a free local port and shuts it down afterward.
It fetches every registered article and existing English fallback guide without
executing JavaScript, validates initial-HTML SEO/content, checks the served
sitemap, and verifies legacy redirects, query preservation, and unknown-route
404s. Failures identify the article source filename, URL, and failing check.

The same command also crawls **every registered public route**, including
articles, tours, booking, FAQ, and informational pages. It checks initial-HTML
anchors and JSON-LD breadcrumb destinations, follows internal redirects (with
loop detection), and checks fragment IDs against destination HTML. Broken pages,
missing fragments, and obsolete legacy token destinations fail the command.
Redirects and potential unintentional language changes are warnings; links with
a matching `hreflang` explicitly declare an intentional language switch.
The crawl never follows external sites or calls private/API endpoints. Downloads,
static-asset links, empty/placeholder links, and non-navigation schemes are skipped.

Booking validation checks the package route **without selection/session query
parameters**; no completed booking, chosen dates, checkout session, or API call is
required. Unknown package routes still fail. The crawler does not click controls,
execute JavaScript, submit forms, or repair links.

Full findings (source URL, destination, link text, context, severity, and reason)
are written to ignored files `generated-artifacts/foundation-links.html` and
`generated-artifacts/foundation-links.json`, even when link failures make the test
exit nonzero. Article references and related-content destinations are validated
against the registries during `npm run articles`; the crawl checks rendered links.

To use an already running production server for the **same local build**, set
`TEST_BASE_URL=http://127.0.0.1:3000`. The test verifies the build ID and production
manifest and rejects development or stale builds. Do not target `npm run dev`.
The configured canonical domain remains independent of the local test origin.

## Admin and Python service

The browser normally requests same-origin paths such as `/admin/auth/session`
and `/api/huts`. Next.js forwards them to Python using the **server-side**
`AVAILABILITY_API_URL`. In development it defaults to `http://127.0.0.1:5001`.
In production, set it to the HTTPS **origin** of a deployed, running FastAPI
service (no path, credentials, or trailing query). Missing configuration gives a
clear admin error rather than returning the website HTML.

The bridge forwards the user's signed session cookie and CSRF token. It never
injects `ADMIN_API_KEY` to grant access. Keep `ADMIN_API_KEY`, `SESSION_SECRET`,
`DATABASE_URL`, and optional Airtable secrets on the Python host. Do not place
secrets in any `NEXT_PUBLIC_` variable or in Git.

Normally leave `NEXT_PUBLIC_AVAILABILITY_API_URL` unset. It is an advanced option
for direct browser access to Python and requires appropriate CORS origins and
cross-site cookie support. The same-origin proxy is simpler.

Python still owns authentication, PostgreSQL jobs/results, the serial scraping
worker, and optional Airtable sync. It must run separately for live admin work;
building/deploying Next.js does not start that worker.

```bash
uv run --no-sync uvicorn hut_availability.app:app --host 0.0.0.0 --port 5001
uv run --no-sync alembic upgrade head
uv run --no-sync python -m hut_availability.seed
uv run --group dev --no-sync python -m unittest discover -s tests -v
```

Checks respect robots.txt and request spacing and never submit bookings.
Manual-only huts are not scraped. Airtable's table and field setup remains
unchanged.

## Vercel migration checklist

1. Push the verified changes yourself using your usual shell workflow.
2. Use **Next.js** as the Vercel framework preset. Remove old Vite overrides,
   especially a `dist` output directory or an `/index.html` SPA fallback.
   The repository's `vercel.json` declares `.next` and `npm run build`.
3. Set `AVAILABILITY_API_URL` for each Vercel environment that needs the admin.
   Remove obsolete `VITE_AVAILABILITY_API_URL`; it is no longer read.
4. Keep Python hosted separately and HTTPS enabled for secure session cookies.
5. Redeploy and check direct links, `/admin`, and a login session.

This task does not publish, configure external Vercel settings, change the
database, or push Git changes automatically.
