# Next.js Site Foundation + Alta Via Admin

## Run

`npm run dev` starts Next.js on `0.0.0.0:5000`. The existing Project workflow
also starts the separate FastAPI service on port 5001.

`npm run build` compiles Markdown/FAQ and SEO files, then generates public pages
with Next.js App Router. `npm run start` serves that production build.
See `README.md` for customization, architecture, and Vercel setup.

## Architectural boundaries

- Public content is static-first with full initial HTML. Article Markdown and
  informational pages remain server components; interactive controls use client
  boundaries. Template booking is a demo, not live inventory or payments.
- Domain/navigation/metadata settings: `src/config/site.ts`. Event copy, display
  brand and colors: `src/content/en/event.ts`. Localized site-specific content
  lives under `src/content/<locale>/`.
- Public routes: explicit `src/app/[locale]/` routes; metadata:
  `src/lib/page-metadata.ts`; route inventory: `src/lib/site-pages.ts`.
  Every public URL includes its locale, including `/en`. Admin/API stay unprefixed.
- Package data lives under locale content folders; lookup is in `src/lib/packages.ts`.
  Booking controls live in `src/components/booking/`; they remain demo-only.
- Next metadata routes own sitemap and robots; do not recreate public copies.
  Missing content translations are visibly marked English fallbacks, noindex,
  canonicalized to English, and excluded from hreflang/sitemap.
- Tailwind discovery is explicitly restricted to `src/`; do not broaden it to
  runtime files or the whole workspace.
- Public and admin routing use Next.js. Admin query/session state persists in its layout.
- Python owns auth, PostgreSQL, scraping jobs/worker, and Airtable sync. Do not
  replace this database or migrate it to Neon without an explicit request.
- The Next.js same-origin admin bridge uses server-only `AVAILABILITY_API_URL`;
  in development it defaults to port 5001. Production must supply a separately
  hosted Python service. Never inject an admin key to bypass user authentication.
- Secrets stay on the backend host, never in `NEXT_PUBLIC_` values.
- `SITE.features.hutAdmin = false` disables admin pages and its API bridge when
  reusing the foundation for another site.

## Checks

```bash
npm run typecheck
npm run build
npm run test:foundation
npm run test:analytics
uv run --group dev --no-sync python -m unittest discover -s tests -v
```

The foundation test inspects generated HTML and metadata, not just serialized
React props. Test interactive flows in the browser after routing changes.

## Availability service

- `/admin` signs in with the `ADMIN_API_KEY`; JSON API supports `X-API-Key`.
- `hut_availability/huts_seed.csv` seeds inventory. Use
  `uv run --no-sync python -m hut_availability.seed` after changing the CSV.
- Apply schema migrations with `uv run --no-sync alembic upgrade head`.
- Checks are serialized, respect robots.txt and pauses, and never book.
- Optional Airtable sync uses `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, and optional
  `AIRTABLE_TABLE` (default `AV1 Availability`). Schema requirements are unchanged.

## Git workflow

The user pushes changes to the remote themselves through shell. Leave pushing
to them unless explicitly requested otherwise.
