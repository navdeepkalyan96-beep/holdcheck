"""Historical option LTP + implied IV vs premium."""

from datetime import datetime, timedelta, timezone

from angel_candles import nifty_candles, option_candles
from black76 import OptionType, greeks
from iv_solve import implied_vol

IST = timezone(timedelta(hours=5, minutes=30))
R = 0.065


def _T(expiry_iso: str, t_raw: str) -> float:
    try:
        t = datetime.fromisoformat(str(t_raw).replace("Z", "+00:00"))
    except ValueError:
        t = datetime.now(IST)
    if t.tzinfo is None:
        t = t.replace(tzinfo=IST)
    exp = datetime.fromisoformat(expiry_iso + "T15:30:00+05:30")
    return max((exp - t).total_seconds(), 0.0) / (365.0 * 24 * 3600)


def study(expiry_iso: str, strike: float, option_type: str) -> dict:
    opt = option_candles(expiry_iso, strike, option_type)
    spot = nifty_candles()
    sm = {s["t"]: s["c"] for s in spot}
    kind = OptionType.CALL if option_type.upper() == "CE" else OptionType.PUT
    rows = []
    for b in opt:
        F = sm.get(b["t"])
        if not F:
            continue
        T = _T(expiry_iso, b["t"])
        iv = implied_vol(F, strike, T, R, kind, b["c"])
        if iv is None:
            continue
        rows.append({"t": b["t"], "spot": F, "ltp": b["c"], "iv": round(iv, 4)})
    rows = rows[-80:]
    d_px, d_iv, d_f = [], [], []
    for a, b in zip(rows, rows[1:]):
        d_px.append(b["ltp"] - a["ltp"])
        d_iv.append(b["iv"] - a["iv"])
        d_f.append(b["spot"] - a["spot"])
    emp_vega = None
    if d_iv:
        # rupees of premium per 1 vol point (0.01) ignoring spot, crude
        num = sum(p * (v * 100) for p, v in zip(d_px, d_iv))
        den = sum((v * 100) ** 2 for v in d_iv) or 1e-9
        emp_vega = num / den
    last = rows[-1] if rows else None
    model_vega = None
    if last:
        T = _T(expiry_iso, last["t"])
        g = greeks(last["spot"], strike, last["iv"], T, R, kind)
        model_vega = g.vega / 100.0  # per vol point, 1 unit
    iv0 = rows[0]["iv"] if rows else None
    iv1 = rows[-1]["iv"] if rows else None
    px0 = rows[0]["ltp"] if rows else None
    px1 = rows[-1]["ltp"] if rows else None
    return {
        "bars": len(rows),
        "iv_start": iv0,
        "iv_end": iv1,
        "iv_change": None if iv0 is None or iv1 is None else round(iv1 - iv0, 4),
        "ltp_start": px0,
        "ltp_end": px1,
        "ltp_change": None if px0 is None or px1 is None else round(px1 - px0, 2),
        "emp_vega_per_vol_point": None if emp_vega is None else round(emp_vega, 3),
        "model_vega_per_vol_point": None if model_vega is None else round(model_vega, 3),
        "note": "IV is implied from each 5m close vs Nifty close. Emp vega = how much premium moved per 1 IV point after lining bars. Model vega is Black-76 at last bar.",
        "tail": rows[-8:],
    }
