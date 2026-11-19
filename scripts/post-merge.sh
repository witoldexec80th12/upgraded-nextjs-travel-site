#!/bin/bash
# Post-merge setup — runs automatically after every task agent merge.
# Must be: idempotent, non-interactive (stdin is closed), and fast.
set -e

echo "[post-merge] Installing dependencies…"
npm ci --prefer-offline
uv sync --locked --no-dev
uv run --no-sync alembic upgrade head

echo "[post-merge] Done."
