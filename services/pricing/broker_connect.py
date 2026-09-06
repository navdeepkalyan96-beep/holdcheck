"""Apply Angel credentials for this process and open a SmartAPI session."""

from __future__ import annotations

import os

import angel_live as al


def connect_user(api_key: str, client_code: str, pin: str, totp: str) -> dict:
    if not all([api_key, client_code, pin, totp]):
        raise ValueError("API key, client code, PIN and TOTP are required")
    os.environ["ANGEL_API_KEY"] = api_key.strip()
    os.environ["ANGEL_CLIENT_CODE"] = client_code.strip()
    os.environ["ANGEL_PIN"] = pin.strip()
    os.environ["ANGEL_TOTP_SECRET"] = totp.strip()
    with al._lock:
        al._sess["jwt"] = None
        al._sess["at"] = 0.0
    al._jwt()
    code = client_code.strip()
    return {"ok": True, "broker": "angel", "client_hint": code[-4:] if len(code) >= 4 else code}


def status() -> dict:
    return {"configured": al.configured(), "session": bool(al._sess.get("jwt")), "broker": "angel" if al.configured() else None}
