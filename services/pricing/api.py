"""HoldCheck pricing API — CSV tickets + live NSE chain book."""

import csv
import io
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ticket_builder import build_ticket, IST
from nse_live import snapshot, quote_leg, oi_window

app = FastAPI(title="HoldCheck Pricing Service", version="0.3.0-live")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Position(BaseModel):
    underlying: str = "NIFTY"
    expiry: str
    strike: float
    option_type: str
    lot_size: int = 65
    side: str
    lots: int
    entry_price: float
    ltp: float | None = None
    bid: float | None = None
    ask: float | None = None
    iv_atm: float | None = None
    atm_ce_premium: float | None = None
    atm_pe_premium: float | None = None
    forward: float | None = None
    target_net: float | None = None
    stop_loss: float | None = None
    max_loss: float | None = None
    hours_open: float | None = None
    entry_time: str | None = None
    ce_oi_change: float | None = None
    pe_oi_change: float | None = None


class LiveBook(BaseModel):
    symbol: str = "NIFTY"
    expiry: str | None = None
    positions: list[Position]


@app.get("/health")
def health():
    return {"status": "ok", "mode": "live", "server_time_ist": datetime.now(IST).isoformat()}


@app.get("/market/nifty")
def market_nifty(expiry: str | None = None):
    try:
        snap = snapshot("NIFTY", expiry)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"NSE chain unavailable: {e}")
    return {
        "symbol": snap["symbol"],
        "underlying": snap["underlying"],
        "forward": snap["forward"],
        "expiry": snap["expiry"],
        "expiries": snap["expiries"],
        "atm_strike": snap["atm_strike"],
        "atm_ce_premium": snap["atm_ce_premium"],
        "atm_pe_premium": snap["atm_pe_premium"],
        "iv_atm": snap["iv_atm"],
        "asof": snap["asof"],
        "strikes": len(snap["rows"]),
    }


def _hydrate(pos: dict, snap: dict) -> dict:
    q = quote_leg(snap, float(pos["strike"]), pos["option_type"])
    if not q:
        raise ValueError(f"No live quote for {pos['strike']} {pos['option_type']} {snap.get('expiry')}")
    ce_chg, pe_chg = oi_window(snap, float(pos["strike"]), n=5)
    pos["underlying"] = snap["symbol"]
    pos["expiry"] = snap["expiry"] or pos["expiry"]
    pos["ltp"] = q.get("ltp")
    pos["bid"] = q.get("bid")
    pos["ask"] = q.get("ask")
    pos["iv_atm"] = snap.get("iv_atm") or q.get("iv") or 0.15
    pos["atm_ce_premium"] = snap.get("atm_ce_premium") or q.get("ltp") or 1
    pos["atm_pe_premium"] = snap.get("atm_pe_premium") or q.get("ltp") or 1
    pos["forward"] = snap.get("forward") or snap.get("underlying")
    pos["ce_oi_change"] = ce_chg
    pos["pe_oi_change"] = pe_chg
    if pos.get("stop_loss") is None and pos.get("max_loss") is not None:
        pos["stop_loss"] = pos["max_loss"]
    return pos


@app.post("/tickets/live")
def tickets_live(book: LiveBook):
    try:
        snap = snapshot(book.symbol, book.expiry)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"NSE chain unavailable: {e}")

    tickets, errors = [], []
    for i, p in enumerate(book.positions):
        try:
            tickets.append(build_ticket(_hydrate(p.model_dump(), snap)))
        except Exception as e:
            errors.append({"row": i, "error": str(e)})
    return {
        "market": {
            "underlying": snap["underlying"],
            "expiry": snap["expiry"],
            "atm_strike": snap["atm_strike"],
            "iv_atm": snap["iv_atm"],
            "asof": snap["asof"],
        },
        "tickets": tickets,
        "errors": errors,
    }


@app.post("/tickets/position")
def ticket_for_position(pos: Position):
    try:
        data = pos.model_dump()
        if data.get("iv_atm") is None:
            snap = snapshot(data.get("underlying") or "NIFTY", data.get("expiry"))
            data = _hydrate(data, snap)
        if data.get("stop_loss") is None and data.get("max_loss") is not None:
            data["stop_loss"] = data["max_loss"]
        return build_ticket(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not compute ticket: {e}")


def _f(row, key):
    raw = row.get(key)
    if raw is None or str(raw).strip() == "":
        return None
    return float(raw)


@app.post("/tickets/csv")
async def tickets_from_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a .csv file")
    raw = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(raw))
    tickets, errors = [], []
    live_needed = False
    rows = list(reader)
    fieldnames = set(reader.fieldnames or [])
    if not {"iv_atm", "atm_ce_premium", "atm_pe_premium", "forward"}.issubset(fieldnames):
        live_needed = True
    snap = None
    if live_needed:
        try:
            first_exp = rows[0]["expiry"] if rows else None
            snap = snapshot("NIFTY", first_exp)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Need chain fields or live NSE: {e}")

    for i, row in enumerate(rows, start=2):
        try:
            pos = {
                "underlying": row.get("underlying") or "NIFTY",
                "expiry": row["expiry"],
                "strike": float(row["strike"]),
                "option_type": row["option_type"].strip().upper(),
                "lot_size": int(row.get("lot_size") or 65),
                "side": row["side"].strip().upper(),
                "lots": int(row["lots"]),
                "entry_price": float(row["entry_price"]),
                "ltp": _f(row, "ltp"),
                "bid": _f(row, "bid"),
                "ask": _f(row, "ask"),
                "iv_atm": _f(row, "iv_atm"),
                "atm_ce_premium": _f(row, "atm_ce_premium"),
                "atm_pe_premium": _f(row, "atm_pe_premium"),
                "forward": _f(row, "forward"),
                "target_net": _f(row, "target_net"),
                "stop_loss": _f(row, "stop_loss") if row.get("stop_loss") not in (None, "") else _f(row, "max_loss"),
                "hours_open": _f(row, "hours_open"),
                "ce_oi_change": _f(row, "ce_oi_change"),
                "pe_oi_change": _f(row, "pe_oi_change"),
            }
            if snap is not None:
                pos = _hydrate(pos, snap)
            tickets.append(build_ticket(pos))
        except Exception as e:
            errors.append({"row": i, "error": str(e)})
    return {"tickets": tickets, "errors": errors}
