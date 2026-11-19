# Hosting the hut admin with Vercel

The Vite build serves the admin interface. Keep the FastAPI availability service on a persistent host: it owns the database connection, scraper worker, and queued checks.

## Vercel environment

Set this public URL for the production Vercel project:

- `VITE_AVAILABILITY_API_URL` — HTTPS origin of the FastAPI service, for example `https://api.huttohuthikingdolomites.it`.

Do not put `ADMIN_API_KEY` or `SESSION_SECRET` in Vercel's `VITE_` variables. Vite embeds `VITE_` values into browser assets.

## FastAPI environment

Configure the API host with:

- `ADMIN_API_KEY` — the operator login key; keep it only on the API host.
- `SESSION_SECRET` — a private, stable signing secret for admin sessions.
- `ADMIN_ALLOWED_ORIGINS` — exact HTTPS origin(s) of the Vercel custom domain, comma-separated, such as `https://huttohuthikingdolomites.it,https://www.huttohuthikingdolomites.it`.
- `COOKIE_SECURE=true` — retain HTTPS-only session cookies.

The production site and API should use HTTPS and be on the same registrable domain (for example, `huttohuthikingdolomites.it` and `api.huttohuthikingdolomites.it`). This allows the browser to send the API's secure session cookie without exposing the admin key. Vercel preview domains on `vercel.app` are cross-site from a custom API domain, so cookie-based admin login may not work from those previews.

## Local development

Leave `VITE_AVAILABILITY_API_URL` unset. Vite proxies `/api`, `/admin/auth`, `/admin/export.csv`, and `/health` to the local FastAPI service on port 5001.
