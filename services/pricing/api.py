"""HoldCheck pricing API — v1 tickets from CSV or a single position."""

import csv
import io
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ticket_builder import build_ticket, IST

app = FastAPI(title="HoldCheck Pricing Service", version="0.2.0")

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
    lot_size: int
    side: str
    lots: int
    entry_price: float
    ltp: float | None = None
    bid: float | None = None
    ask: float | None = None
    iv_atm: float
    atm_ce_premium: float
    atm_pe_premium: float
    forward: float
    target_net: float | None = None
    stop_loss: float | None = None
    max_loss: float | None = None
    hours_held: float | None = None
    entry_time: str | None = None
    oi_ladder: str | None = None


CSV_COLUMNS = [
    "underlying", "expiry", "strike", "option_type", "lot_size", "side", "lots",
    "entry_price", "ltp", "bid", "ask", "iv_atm", "atm_ce_premium", "atm_pe_premium",
    "forward", "target_net", "stop_loss", "hours_held", "oi_ladder",
]


@app.get("/health")
def health():
    return {"status": "ok", "server_time_ist": datetime.now(IST).isoformat()}


@app.get("/csv-template")
def csv_template():
    example = {
        "underlying": "NIFTY", "expiry": "2026-09-04", "strike": 24800,
        "option_type": "CE", "lot_size": 25, "side": "LONG", "lots": 2,
        "entry_price": 142.0, "ltp": 108.5, "bid": 107.0, "ask": 110.0,
        "iv_atm": 0.135, "atm_ce_premium": 118.0, "atm_pe_premium": 96.0,
        "forward": 24812.0, "target_net": 5000.0, "stop_loss": 2500.0,
        "hours_held": 6.0,
        "oi_ladder": "24750:800,900,1200,1500|24775:700,720,1100,1300|24800:1000,1400,900,800|24825:900,1300,700,680|24850:850,1500,600,500",
    }
    return {"columns": CSV_COLUMNS, "example_row": example}


@app.post("/tickets/position")
def ticket_for_position(pos: Position):
    try:
        data = pos.model_dump()
        if data.get("stop_loss") is None:
            data["stop_loss"] = data.get("max_loss")
        return build_ticket(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not compute ticket: {e}")


def _f(row, key):
    v = row.get(key)
    if v is None or str(v).strip() == "":
        return None
    return float(v)


@app.post("/tickets/csv")
async def tickets_from_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a .csv file")

    raw = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(raw))
    missing = {"underlying", "expiry", "strike", "option_type", "lot_size",
               "side", "lots", "entry_price", "iv_atm", "atm_ce_premium",
               "atm_pe_premium", "forward"} - set(reader.fieldnames or [])
    if missing:
        raise HTTPException(status_code=400, detail=f"CSV missing required columns: {sorted(missing)}")

    tickets, errors = [], []
    for i, row in enumerate(reader, start=2):
        try:
            sl = _f(row, "stop_loss")
            if sl is None:
                sl = _f(row, "max_loss")
            pos = {
                "underlying": row["underlying"],
                "expiry": row["expiry"],
                "strike": float(row["strike"]),
                "option_type": row["option_type"].strip().upper(),
                "lot_size": int(row["lot_size"]),
                "side": row["side"].strip().upper(),
                "lots": int(row["lots"]),
                "entry_price": float(row["entry_price"]),
                "ltp": _f(row, "ltp"),
                "bid": _f(row, "bid"),
                "ask": _f(row, "ask"),
                "iv_atm": float(row["iv_atm"]),
                "atm_ce_premium": float(row["atm_ce_premium"]),
                "atm_pe_premium": float(row["atm_pe_premium"]),
                "forward": float(row["forward"]),
                "target_net": _f(row, "target_net"),
                "stop_loss": sl,
                "hours_held": _f(row, "hours_held"),
                "entry_time": row.get("entry_time") or None,
                "oi_ladder": row.get("oi_ladder") or None,
            }
            tickets.append(build_ticket(pos))
        except Exception as e:
            errors.append({"row": i, "error": str(e)})

    return {"tickets": tickets, "errors": errors}
