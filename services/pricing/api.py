"""
api.py — FastAPI pricing/ticket service.

v0-live scope: no auth, no DB, no broker OAuth. Stateless — accepts a CSV of
positions (or a single JSON position) and returns computed tickets. This is
deliberately the smallest slice that's useful: point it at a tradebook CSV
you export from your broker and get back the same ticket the full product
would eventually compute live.

Run: uvicorn api:app --reload --port 8000
"""

import csv
import io
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ticket_builder import build_ticket, IST

app = FastAPI(title="HoldCheck Pricing Service", version="0.1.0")

# TODO: lock this down to your deployed frontend origin before going public
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Position(BaseModel):
    underlying: str = "NIFTY"
    expiry: str          # YYYY-MM-DD
    strike: float
    option_type: str     # 'CE' | 'PE'
    lot_size: int
    side: str             # 'LONG' | 'SHORT'
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
    max_loss: float | None = None


CSV_COLUMNS = [
    "underlying", "expiry", "strike", "option_type", "lot_size", "side", "lots",
    "entry_price", "ltp", "bid", "ask", "iv_atm", "atm_ce_premium", "atm_pe_premium",
    "forward", "target_net", "max_loss",
]


@app.get("/health")
def health():
    return {"status": "ok", "server_time_ist": datetime.now(IST).isoformat()}


@app.get("/csv-template")
def csv_template():
    """Returns the expected CSV column order + one example row, so the frontend
    can offer a download-template button."""
    example = {
        "underlying": "NIFTY", "expiry": "2026-09-04", "strike": 24800,
        "option_type": "CE", "lot_size": 25, "side": "LONG", "lots": 2,
        "entry_price": 142.0, "ltp": 108.5, "bid": 107.0, "ask": 110.0,
        "iv_atm": 0.135, "atm_ce_premium": 118.0, "atm_pe_premium": 96.0,
        "forward": 24812.0, "target_net": 5000.0, "max_loss": "",
    }
    return {"columns": CSV_COLUMNS, "example_row": example}


@app.post("/tickets/position")
def ticket_for_position(pos: Position):
    try:
        return build_ticket(pos.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not compute ticket: {e}")


@app.post("/tickets/csv")
async def tickets_from_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a .csv file")

    raw = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(raw))

    missing_cols = set(["underlying", "expiry", "strike", "option_type", "lot_size",
                         "side", "lots", "entry_price", "iv_atm", "atm_ce_premium",
                         "atm_pe_premium", "forward"]) - set(reader.fieldnames or [])
    if missing_cols:
        raise HTTPException(status_code=400, detail=f"CSV missing required columns: {sorted(missing_cols)}")

    tickets, errors = [], []
    for i, row in enumerate(reader, start=2):  # row 1 is header
        try:
            pos = {
                "underlying": row["underlying"],
                "expiry": row["expiry"],
                "strike": float(row["strike"]),
                "option_type": row["option_type"].strip().upper(),
                "lot_size": int(row["lot_size"]),
                "side": row["side"].strip().upper(),
                "lots": int(row["lots"]),
                "entry_price": float(row["entry_price"]),
                "ltp": float(row["ltp"]) if row.get("ltp") else None,
                "bid": float(row["bid"]) if row.get("bid") else None,
                "ask": float(row["ask"]) if row.get("ask") else None,
                "iv_atm": float(row["iv_atm"]),
                "atm_ce_premium": float(row["atm_ce_premium"]),
                "atm_pe_premium": float(row["atm_pe_premium"]),
                "forward": float(row["forward"]),
                "target_net": float(row["target_net"]) if row.get("target_net") else None,
                "max_loss": float(row["max_loss"]) if row.get("max_loss") else None,
            }
            tickets.append(build_ticket(pos))
        except Exception as e:
            errors.append({"row": i, "error": str(e)})

    return {"tickets": tickets, "errors": errors}
