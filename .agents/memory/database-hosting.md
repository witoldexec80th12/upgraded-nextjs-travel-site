---
name: External PostgreSQL hosting
description: The user's choice of Neon for the application's database and the distinction from Replit-managed databases.
---

The user supplied a Neon PostgreSQL connection through the Replit `DATABASE_URL` secret and explicitly confirmed it is for production.

**Why:** The user is preparing the site for Vercel and chose Neon as the database provider. The Replit database pane or database callbacks can refer to a different database from the application's configured connection.

**How to apply:** Treat the workspace application's database connection as production unless the user explicitly switches it. Use a separate database or Neon branch for database-writing tests and experiments. Use the application's configured connection for verification without exposing credentials, and confirm the target before schema or data changes. Do not assume Replit Publish provisions or migrates this external database.
