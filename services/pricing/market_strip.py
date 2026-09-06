"""Homepage tape — Yahoo public chart quotes (no key)."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

ROWS = [
    ("NIFTY", "^NSEI", "Nifty"),
    ("SENSEX", "^BSESN", "Sensex"),
    ("BANKNIFTY", "^NSEBANK", "Bank Nifty"),
    ("FINNIFTY", "NIFTY_FIN_SERVICE.NS", "Fin Nifty"),
    ("SPX", "^GSPC", "S&P 500"),
    ("NASDAQ", "^IXIC", "Nasdaq"),
    ("DAX", "^GDAXI", "DAX"),
    ("STOXX", "^STOXX50E", "Euro Stoxx"),
    ("NIKKEI", "^N225", "Nikkei"),
    ("HSI", "^HSI", "Hang Seng"),
    ("BRENT", "BZ=F", "Brent"),
    ("DXY", "DX-Y.NYB", "US Dollar"),
    ("US10Y", "^TNX", "US 10Y"),
]

UA = {"User-Agent": "Mozilla/5.0 HoldCheckTape/1.0"}


def _one(sym: str) -> dict | None:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=5d"
    r = requests.get(url, headers=UA, timeout=8)
    r.raise_for_status()
    result = ((r.json() or {}).get("chart") or {}).get("result") or []
    if not result:
        return None
    meta = result[0].get("meta") or {}
    last = meta.get("regularMarketPrice") or meta.get("previousClose")
    prev = meta.get("chartPreviousClose") or meta.get("previousClose")
    if last is None:
        return None
    last = float(last)
    prev = float(prev or last)
    chg = last - prev
    pct = (chg / prev * 100) if prev else 0.0
    return {"last": round(last, 2), "chg": round(chg, 2), "pct": round(pct, 2)}


def tape() -> dict:
    out = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futs = {pool.submit(_one, y): (code, y, label) for code, y, label in ROWS}
        got = {}
        for fut in as_completed(futs):
            code, y, label = futs[fut]
            try:
                q = fut.result()
            except Exception:
                q = None
            got[code] = {"code": code, "label": label, "symbol": y, **(q or {"last": None, "chg": None, "pct": None})}
    for code, _, _ in ROWS:
        out.append(got[code])
    return {"rows": out}
