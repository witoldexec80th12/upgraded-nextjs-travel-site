---
name: Google Sheets connector runtime
description: Project-specific guidance for reaching the connected Google Sheets account from the availability service.
---

Use Replit's Node connector SDK for application calls to the connected Google Sheets account. The Python package named in the integration instructions was not available from this workspace's configured Python package registry, so Python worker code delegates provider requests to the Node adapter.

**Why:** The integration credentials are managed by Replit; implementing separate Google OAuth credentials in the Python service would duplicate auth and create unnecessary secrets.

**How to apply:** Keep Sheets calls on the Replit runtime using `@replit/connectors-sdk`. If the Python worker moves to another host, replace this adapter with that host's supported Google authentication before enabling exports there.
