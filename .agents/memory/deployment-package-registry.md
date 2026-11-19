---
name: Deployment package registry
description: Avoid private Replit package-host URLs in lockfiles used by external deployment builders.
---

Before deploying this project outside Replit, ensure `package-lock.json` points to public npm tarball URLs rather than `package-firewall.replit.local`.

**Why:** Replit-generated lockfiles can preserve private firewall URLs, which external builders such as Vercel cannot resolve.

**How to apply:** If an external install reports DNS failures for `package-firewall.replit.local`, inspect the lockfile and regenerate or normalize its tarball URLs to `https://registry.npmjs.org/`, then run a clean install and production build.
