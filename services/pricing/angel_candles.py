from __future__ import annotations

from datetime import datetime, timedelta, timezone
import requests

from angel_live import MASTER, _headers, _jwt, _master, _parse_expiry, _strike, _opt_type

CANDLE = "https://apiconnect.angelone.in/rest/secure/angelbroking/historical/v1/getCandleData"
IST = timezone(timedelta(hours=5, minutes=30))
NIFTY_TOKEN = "99926000"


def _window():
    now = datetime.now(IST)
    start = (now - timedelta(days=5)).replace(hour=9, minute=15, second=0, microsecond=0)
    return start.strftime("%Y-%m-%d %H:%M"), now.strftime("%Y-%m-%d %H:%M")


def _fetch(exchange: str, token: str):
    jwt = _jwt()
    frm, to = _window()
    r = requests.post(
        CANDLE,
        json={
            "exchange": exchange,
            "symboltoken": str(token),
            "interval": "FIVE_MINUTE",
            "fromdate": frm,
            "todate": to,
        },
        headers=_headers(jwt),
        timeout=20,
    )
    body = r.json() if r.content else {}
    rows = body.get("data") or []
    out = []
    for row in rows:
        if not isinstance(row, (list, tuple)) or len(row) < 5:
            continue
        out.append({"t": row[0], "o": float(row[1]), "h": float(row[2]), "l": float(row[3]), "c": float(row[4])})
    return out


def nifty_candles():
    return _fetch("NSE", NIFTY_TOKEN)


def option_token(expiry_iso: str, strike: float, option_type: str) -> str | None:
    want = option_type.upper()
    k = float(strike)
    for row in _master():
        exp = _parse_expiry(str(row.get("expiry") or ""))
        if exp != expiry_iso:
            continue
        if _opt_type(row) != want:
            continue
        if abs(_strike(row) - k) < 0.6:
            return str(row.get("token"))
    return None


def option_candles(expiry_iso: str, strike: float, option_type: str):
    tok = option_token(expiry_iso, strike, option_type)
    if not tok:
        return []
    return _fetch("NFO", tok)
