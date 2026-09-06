"""Fetch NSE index option-chain JSON."""

from __future__ import annotations

from datetime import datetime
from threading import Lock
import time

import requests

NSE_HOME = "https://www.nseindia.com"
WARM_URLS = [
    "https://www.nseindia.com/option-chain",
    "https://www.nseindia.com/market-data/option-chain",
]
CHAIN_V3 = "https://www.nseindia.com/api/option-chain-v3"
CHAIN_LEGACY = "https://www.nseindia.com/api/option-chain-indices"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/option-chain",
}

_lock = Lock()
_state: dict = {"session": None, "at": 0.0}


def _fresh_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    for url in WARM_URLS:
        try:
            s.get(url, timeout=12)
        except requests.RequestException:
            continue
    return s


def _get_session(force: bool = False) -> requests.Session:
    with _lock:
        now = time.time()
        sess = _state["session"]
        if force or sess is None or now - _state["at"] > 180:
            sess = _fresh_session()
            _state["session"] = sess
            _state["at"] = now
        return sess


def _parse_expiry(label: str) -> str:
    return datetime.strptime(label.strip(), "%d-%b-%Y").date().isoformat()


def _looks_like_chain(payload: object) -> bool:
    if not isinstance(payload, dict):
        return False
    rec = payload.get("records") or payload.get("filtered") or {}
    if not isinstance(rec, dict):
        return False
    return bool(rec.get("data") or rec.get("expiryDates"))


def fetch_chain(symbol: str = "NIFTY") -> dict:
    s = _get_session()
    attempts = [
        (CHAIN_V3, {"type": "Indices", "symbol": symbol.upper()}),
        (CHAIN_LEGACY, {"symbol": symbol.upper()}),
    ]
    last_err = "no response"
    for url, params in attempts:
        try:
            r = s.get(url, params=params, timeout=20)
        except requests.RequestException as e:
            last_err = str(e)
            continue
        if r.status_code != 200:
            last_err = f"{r.status_code} {url}"
            s = _get_session(force=True)
            continue
        try:
            payload = r.json()
        except ValueError:
            last_err = "non-JSON from NSE"
            continue
        if _looks_like_chain(payload):
            return payload
        last_err = "NSE returned empty chain (bot wall / cloud IP)"
    raise RuntimeError(
        f"{last_err}. NSE blocks most cloud hosts. Dropdowns still work; "
        "live LTP needs an India IP or a broker feed."
    )


def list_expiries(payload: dict) -> list[str]:
    labels = payload.get("records", {}).get("expiryDates") or []
    out = []
    for lab in labels:
        try:
            out.append(_parse_expiry(str(lab)))
        except ValueError:
            continue
    return out


def _side(row: dict, which: str) -> dict | None:
    block = row.get(which)
    if not block:
        return None
    iv = block.get("impliedVolatility")
    return {
        "ltp": block.get("lastPrice"),
        "bid": block.get("bidprice"),
        "ask": block.get("askPrice"),
        "oi": block.get("openInterest") or 0,
        "oi_change": block.get("changeinOpenInterest") or 0,
        "iv": (float(iv) / 100.0) if iv else None,
        "volume": block.get("totalTradedVolume") or 0,
    }


def snapshot(symbol: str = "NIFTY", expiry_iso: str | None = None) -> dict:
    payload = fetch_chain(symbol)
    records = payload.get("records", {})
    underlying = float(records.get("underlyingValue") or 0)
    expiries = list_expiries(payload)
    if not expiry_iso:
        expiry_iso = expiries[0] if expiries else None

    rows = []
    for item in records.get("data") or []:
        try:
            exp = _parse_expiry(str(item.get("expiryDate") or ""))
        except ValueError:
            continue
        if expiry_iso and exp != expiry_iso:
            continue
        rows.append({
            "strike": float(item.get("strikePrice") or 0),
            "expiry": exp,
            "CE": _side(item, "CE"),
            "PE": _side(item, "PE"),
        })

    strikes = sorted({r["strike"] for r in rows})
    atm = min(strikes, key=lambda k: abs(k - underlying)) if strikes else None
    atm_ce = next((r["CE"] for r in rows if r["strike"] == atm and r["CE"]), None) if atm else None
    atm_pe = next((r["PE"] for r in rows if r["strike"] == atm and r["PE"]), None) if atm else None
    ivs = [x for x in [
        atm_ce.get("iv") if atm_ce else None,
        atm_pe.get("iv") if atm_pe else None,
    ] if x]
    iv_atm = sum(ivs) / len(ivs) if ivs else None

    return {
        "symbol": symbol.upper(),
        "underlying": underlying,
        "forward": underlying,
        "expiry": expiry_iso,
        "expiries": expiries,
        "atm_strike": atm,
        "atm_ce_premium": (atm_ce or {}).get("ltp"),
        "atm_pe_premium": (atm_pe or {}).get("ltp"),
        "iv_atm": iv_atm,
        "rows": rows,
        "asof": datetime.utcnow().isoformat() + "Z",
    }


def quote_leg(snap: dict, strike: float, option_type: str) -> dict | None:
    opt = option_type.upper()
    for r in snap["rows"]:
        if abs(r["strike"] - float(strike)) < 1e-6:
            return r.get(opt)
    return None


def oi_window(snap: dict, entry_strike: float, n: int = 5) -> tuple[float, float]:
    strikes = sorted({r["strike"] for r in snap["rows"]})
    if not strikes:
        return 0.0, 0.0
    idx = min(range(len(strikes)), key=lambda i: abs(strikes[i] - entry_strike))
    lo, hi = max(0, idx - n), min(len(strikes), idx + n + 1)
    window = set(strikes[lo:hi])
    ce = pe = 0.0
    for r in snap["rows"]:
        if r["strike"] not in window:
            continue
        if r.get("CE"):
            ce += float(r["CE"].get("oi_change") or 0)
        if r.get("PE"):
            pe += float(r["PE"].get("oi_change") or 0)
    return ce, pe
