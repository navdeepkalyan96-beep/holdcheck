"""HoldCheck pricing API — Angel One first, NSE scrape fallback."""

from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ticket_builder import build_ticket, IST
from nse_live import snapshot as nse_snapshot, quote_leg, oi_window
from angel_live import configured as angel_configured, snapshot as angel_snapshot

app = FastAPI(title="HoldCheck Pricing Service", version="0.4.0-angel")

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


def _snap(expiry: str | None = None) -> dict:
    errors = []
    if angel_configured():
        try:
            return angel_snapshot("NIFTY", expiry)
        except Exception as e:
            errors.append(f"angel: {e}")
    try:
        return nse_snapshot("NIFTY", expiry)
    except Exception as e:
        errors.append(f"nse: {e}")
    raise RuntimeError(" | ".join(errors) or "no market source")


def _market_payload(snap: dict) -> dict:
    strikes = sorted({int(r["strike"]) for r in snap["rows"]})
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
        "strikes": strikes,
        "source": snap.get("source") or "nse",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "mode": "angel" if angel_configured() else "nse-scrape",
        "server_time_ist": datetime.now(IST).isoformat(),
    }


@app.get("/market/nifty")
def market_nifty(expiry: str | None = None):
    try:
        snap = _snap(expiry)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return _market_payload(snap)


def _hydrate(pos: dict, snap: dict) -> dict:
    q = quote_leg(snap, float(pos["strike"]), pos["option_type"])
    if not q:
        raise ValueError(f"No quote for {pos['strike']} {pos['option_type']} {snap.get('expiry')}")
    ce_chg, pe_chg = oi_window(snap, float(pos["strike"]), n=5)
    pos["underlying"] = snap["symbol"]
    pos["expiry"] = snap["expiry"] or pos["expiry"]
    pos["ltp"] = q.get("ltp")
    pos["bid"] = q.get("bid")
    pos["ask"] = q.get("ask")
    pos["iv_atm"] = snap.get("iv_atm") or 0.15
    pos["atm_ce_premium"] = snap.get("atm_ce_premium") or q.get("ltp") or 1
    pos["atm_pe_premium"] = snap.get("atm_pe_premium") or q.get("ltp") or 1
    pos["forward"] = snap.get("forward") or snap.get("underlying") or 0
    pos["ce_oi_change"] = ce_chg
    pos["pe_oi_change"] = pe_chg
    if pos.get("stop_loss") is None and pos.get("max_loss") is not None:
        pos["stop_loss"] = pos["max_loss"]
    return pos


@app.post("/tickets/live")
def tickets_live(book: LiveBook):
    try:
        snap = _snap(book.expiry)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    tickets, errors = [], []
    for i, p in enumerate(book.positions):
        try:
            tickets.append(build_ticket(_hydrate(p.model_dump(), snap)))
        except Exception as e:
            errors.append({"row": i, "error": str(e)})
    return {"market": _market_payload(snap), "tickets": tickets, "errors": errors}
