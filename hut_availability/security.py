from __future__ import annotations

import hmac
import os

from fastapi import Header, HTTPException, Request


def expected_admin_key() -> str:
    value = os.getenv("ADMIN_API_KEY")
    if not value:
        raise RuntimeError("ADMIN_API_KEY is not configured; protected routes are disabled.")
    return value


def expected_session_secret() -> str:
    value = os.getenv("SESSION_SECRET")
    if not value:
        raise RuntimeError("SESSION_SECRET is not configured; admin sessions cannot be signed.")
    return value


def require_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    expected = expected_admin_key()
    if not x_api_key or not hmac.compare_digest(x_api_key, expected):
        raise HTTPException(status_code=401, detail="Valid X-API-Key required.")


def require_admin_access(
    request: Request,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    x_csrf_token: str | None = Header(default=None, alias="X-CSRF-Token"),
) -> None:
    expected = expected_admin_key()
    if x_api_key and hmac.compare_digest(x_api_key, expected):
        return
    if not is_admin_session(request):
        raise HTTPException(status_code=401, detail="Admin sign-in required.")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        expected_csrf = request.session.get("csrf_token", "")
        if not expected_csrf or not x_csrf_token or not hmac.compare_digest(
            x_csrf_token, expected_csrf
        ):
            raise HTTPException(status_code=403, detail="Valid CSRF token required.")


def get_csrf_token(request: Request) -> str:
    token = request.session.get("csrf_token")
    if not token:
        from secrets import token_urlsafe

        token = token_urlsafe(32)
        request.session["csrf_token"] = token
    return token


def verify_session_csrf(request: Request, token: str | None) -> None:
    expected = request.session.get("csrf_token", "")
    if not expected or not token or not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=403, detail="Valid CSRF token required.")


def is_admin_session(request: Request) -> bool:
    return request.session.get("is_admin") is True
