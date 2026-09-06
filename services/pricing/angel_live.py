"""Angel One SmartAPI — NIFTY option quotes. Credentials from env only."""

from __future__ import annotations

from datetime import datetime
from threading import Lock
import os
import re
import time

import pyotp
import requests

BASE = "https://apiconnect.angelone.in"
LOGIN = f"{BASE}/rest/auth/angelbroking/user/v1/loginByPassword"
QUOTE = f"{BASE}/rest/secure/angelbroking/market/v1/quote"
LTP = f"{BASE}/rest/secure/angelbroking/order/v1/getLtpData"
MASTER = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"

_lock = Lock()
_sess: dict = {"jwt": None, "at": 0.0, "master": None, "master_at": 0.0}


def configured() -> bool:
    return all(
        os.environ.get(k)
        for k in ("ANGEL_API_KEY", "ANGEL_CLIENT_CODE", "ANGEL_PIN", "ANGEL_TOTP_SECRET")
    )


def _totp_now() -> str:
    raw = os.environ.get("ANGEL_TOTP_SECRET") or ""
    raw = re.sub(r"\s+", "", raw).upper()
    if raw.isdigit() and len(raw) == 6:
        return raw  # user pasted the current 6-digit code (expires in ~30s)
    pad = (8 - len(raw) % 8) % 8
    raw = raw + ("=" * pad)
    return pyotp.TOTP(raw).now()


def _headers(jwt: str | None = None) -> dict:
    h = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-UserType": "USER",
        "X-SourceID": "WEB",
        "X-ClientLocalIP": "127.0.0.1",
        "X-ClientPublicIP": "127.0.0.1",
        "X-MACAddress": "00:00:00:00:00:00",
        "X-PrivateKey": os.environ["ANGEL_API_KEY"],
    }
    if jwt:
        h["Authorization"] = f"Bearer {jwt}"
    return h


def _login() -> str:
    r = requests.post(
        LOGIN,
        json={
            "clientcode": os.environ["ANGEL_CLIENT_CODE"].strip(),
            "password": os.environ["ANGEL_PIN"].strip(),
            "totp": _totp_now(),
        },
        headers=_headers(),
        timeout=20,
    )
    r.raise_for_status()
    body = r.json()
    if not body.get("status"):
        raise RuntimeError(body.get("message") or body.get("errorcode") or "Angel login failed")
    jwt = (body.get("data") or {}).get("jwtToken")
    if not jwt:
        raise RuntimeError("Angel login returned no jwtToken")
    return jwt
