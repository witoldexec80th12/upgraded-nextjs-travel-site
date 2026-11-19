---
name: Next.js development in Replit
description: Why this project uses Webpack for development but the default Next.js production bundler.
---

Use Webpack for Next.js development in this environment; leave production builds on the default bundler unless testing shows a reason to change.

**Why:** During the migration, Next.js 16.4's Turbopack development server returned invalid WebSocket handshake responses in this Replit environment. Pages displayed their server HTML but never hydrated, so controls silently did nothing. Webpack development restored working hydration and browser tests passed. Production Turbopack builds also worked.

**How to apply:** If revisiting the development bundler, verify actual clicks and client navigation through the proxied preview, not just HTML or a screenshot. Development-origin patterns must include nested Replit subdomains, not only one hostname label.

Keep the root theme style in the document body rather than a manually ordered head child.

**Why:** Replit's preview injects its development-tool script into the head. React treated that injected script as a mismatch against the manually placed theme style, even though direct browser tests were clean. Moving the style into the body removed the preview-only hydration error.

**How to apply:** Check the embedded preview's console as well as direct-browser tests after root-document changes; the preview has injected elements that a standalone browser does not.
