from __future__ import annotations

import base64
import hashlib
import hmac
import os
import time

COOKIE_NAME = "meeting_session"
COOKIE_TTL_SEC = 24 * 60 * 60  # 24h
HANDOFF_TTL_MS_MAX = 10 * 60 * 1000


def _secret() -> bytes:
    s = os.environ.get("HMAC_SECRET")
    if not s:
        raise RuntimeError("HMAC_SECRET is not set")
    return s.encode("utf-8")


def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def verify_handoff(t: str, s: str, expected_tool: str) -> bool:
    """Verify a portal-issued handoff token.

    t = base64url(f"{tool}.{exp_ms}")
    s = base64url(HMAC_SHA256(secret, t))
    """
    try:
        expected_sig = hmac.new(_secret(), t.encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64url(expected_sig), s):
            return False
        payload = _b64url_decode(t).decode("utf-8")
        tool, exp_ms_str = payload.rsplit(".", 1)
        if tool != expected_tool:
            return False
        exp_ms = int(exp_ms_str)
        now_ms = int(time.time() * 1000)
        if now_ms > exp_ms:
            return False
        if exp_ms - now_ms > HANDOFF_TTL_MS_MAX:
            return False
        return True
    except Exception:
        return False


def issue_session() -> str:
    exp_sec = int(time.time()) + COOKIE_TTL_SEC
    payload = _b64url(str(exp_sec).encode("ascii"))
    sig = _b64url(hmac.new(_secret(), payload.encode("ascii"), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def verify_session(cookie_value: str | None) -> bool:
    if not cookie_value:
        return False
    try:
        payload, sig = cookie_value.rsplit(".", 1)
        expected_sig = _b64url(
            hmac.new(_secret(), payload.encode("ascii"), hashlib.sha256).digest()
        )
        if not hmac.compare_digest(expected_sig, sig):
            return False
        exp_sec = int(_b64url_decode(payload).decode("ascii"))
        return int(time.time()) < exp_sec
    except Exception:
        return False
