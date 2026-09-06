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
        return raw
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


def _jwt() -> str:
    with _lock:
        now = time.time()
        if _sess["jwt"] and now - _sess["at"] < 6 * 3600:
            return _sess["jwt"]
        token = _login()
        _sess["jwt"] = token
        _sess["at"] = now
        return token


def _master() -> list[dict]:
    with _lock:
        now = time.time()
        if _sess["master"] and now - _sess["master_at"] < 12 * 3600:
            return _sess["master"]
    r = requests.get(MASTER, timeout=60)
    r.raise_for_status()
    rows = r.json()
    nifty = [
        x for x in rows
        if str(x.get("exch_seg", "")).upper() == "NFO"
        and str(x.get("name", "")).upper() == "NIFTY"
        and "OPT" in str(x.get("instrumenttype", "")).upper()
    ]
    with _lock:
        _sess["master"] = nifty
        _sess["master_at"] = time.time()
    return nifty


def _parse_expiry(raw: str) -> str | None:
    raw = (raw or "").strip().upper()
    for fmt in ("%d%b%Y", "%d%b%y", "%d-%b-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _opt_type(row: dict) -> str | None:
    sym = str(row.get("symbol") or row.get("tradingsymbol") or "").upper()
    if sym.endswith("CE"):
        return "CE"
    if sym.endswith("PE"):
        return "PE"
    return None


def _spot() -> float:
    try:
        jwt = _jwt()
        r = requests.post(
            LTP,
            json={"exchange": "NSE", "tradingsymbol": "Nifty 50", "symboltoken": "99926000"},
            headers=_headers(jwt),
            timeout=15,
        )
        data = (r.json() or {}).get("data") or {}
        return float(data.get("ltp") or 0)
    except Exception:
        return 0.0


def _quotes(tokens: list[str]) -> dict[str, dict]:
    if not tokens:
        return {}
    jwt = _jwt()
    out: dict[str, dict] = {}
    for i in range(0, len(tokens), 50):
        chunk = tokens[i : i + 50]
        r = requests.post(
            QUOTE,
            json={"mode": "FULL", "exchangeTokens": {"NFO": chunk}},
            headers=_headers(jwt),
            timeout=20,
        )
        body = r.json() if r.content else {}
        fetched = (body.get("data") or {}).get("fetched") or body.get("data") or []
        if isinstance(fetched, dict):
            fetched = fetched.get("fetched") or []
        for q in fetched or []:
            tok = str(q.get("symbolToken") or q.get("token") or "")
            ltp = q.get("ltp") or q.get("lastPrice")
            depth = q.get("depth") or {}
            buy = (depth.get("buy") or [{}])[:1]
            sell = (depth.get("sell") or [{}])[:1]
            bid = (buy[0] or {}).get("price") if buy else q.get("bidPrice")
            ask = (sell[0] or {}).get("price") if sell else q.get("askPrice")
            out[tok] = {
                "ltp": ltp,
                "bid": bid,
                "ask": ask,
                "oi": q.get("opnInterest") or q.get("oi") or 0,
                "oi_change": 0,
                "iv": None,
                "volume": q.get("tradeVolume") or 0,
            }
    return out


def snapshot(symbol: str = "NIFTY", expiry_iso: str | None = None) -> dict:
    if not configured():
        raise RuntimeError("Angel env not set")
    master = _master()
    by_exp: dict[str, list[dict]] = {}
    for row in master:
        exp = _parse_expiry(str(row.get("expiry") or ""))
        if not exp:
            continue
        by_exp.setdefault(exp, []).append(row)
    expiries = sorted(by_exp)
    if not expiry_iso:
        today = datetime.utcnow().date().isoformat()
        future = [e for e in expiries if e >= today]
        expiry_iso = future[0] if future else (expiries[0] if expiries else None)
    legs = by_exp.get(expiry_iso or "", [])
    spot = _spot()
    tokens = [str(r.get("token")) for r in legs if r.get("token")]
    if spot and legs:
        ranked = sorted(legs, key=lambda r: abs(float(r.get("strike") or 0) - spot))
        tokens = [str(r.get("token")) for r in ranked[:80] if r.get("token")]
    quotes = _quotes(tokens)

    rows_map: dict[float, dict] = {}
    for r in legs:
        strike = float(r.get("strike") or 0)
        opt = _opt_type(r)
        if not strike or not opt:
            continue
        q = quotes.get(str(r.get("token"))) or {
            "ltp": None, "bid": None, "ask": None, "oi": 0, "oi_change": 0, "iv": None, "volume": 0,
        }
        slot = rows_map.setdefault(strike, {"strike": strike, "expiry": expiry_iso, "CE": None, "PE": None})
        slot[opt] = q

    rows = [rows_map[k] for k in sorted(rows_map)]
    strikes = [r["strike"] for r in rows]
    atm = min(strikes, key=lambda k: abs(k - spot)) if strikes and spot else (strikes[len(strikes)//2] if strikes else None)
    atm_ce = next((r["CE"] for r in rows if r["strike"] == atm and r["CE"]), None) if atm else None
    atm_pe = next((r["PE"] for r in rows if r["strike"] == atm and r["PE"]), None) if atm else None
    return {
        "symbol": "NIFTY",
        "underlying": spot,
        "forward": spot,
        "expiry": expiry_iso,
        "expiries": expiries,
        "atm_strike": atm,
        "atm_ce_premium": (atm_ce or {}).get("ltp"),
        "atm_pe_premium": (atm_pe or {}).get("ltp"),
        "iv_atm": None,
        "rows": rows,
        "asof": datetime.utcnow().isoformat() + "Z",
        "source": "angel",
    }
