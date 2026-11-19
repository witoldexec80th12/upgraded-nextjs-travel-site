---
name: Tailwind source scanning
description: Restrict Tailwind class discovery to actual frontend sources to prevent development reload loops.
---

Keep Tailwind source discovery restricted to frontend source files rather than scanning the whole workspace.

**Why:** Runtime-managed files in this workspace change frequently; when Tailwind watches them as class sources it can trigger continuous full-page reloads, leaving the admin screen apparently blank.

**How to apply:** When adding frontend source locations outside the existing scan, explicitly include only those locations. Avoid broad workspace-level scanning.
