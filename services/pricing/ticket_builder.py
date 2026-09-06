"""ticket_builder.py"""

from datetime import datetime, timedelta, timezone

from fee_engine import FeeTableVersion, Side, net_if_exited_now, transaction_charges
from black76 import OptionType, price, greeks, solve_required_forward
from iv_solve import implied_vol
from state_classifier import classify_greeks
from oi_bias import classify_oi

IST = timezone(timedelta(hours=5, minutes=30))
FEE_TABLE = FeeTableVersion()
RISK_FREE_RATE = 0.065
IV_SCENARIOS = (("iv_minus_2pct", 0.98), ("iv_unchanged", 1.00), ("iv_plus_2pct", 1.02))
_LAST_IV: dict[str, float] = {}


def _years_to_expiry(expiry_date_str: str, now: datetime) -> float:
    expiry = datetime.fromisoformat(expiry_date_str + "T15:30:00+05:30")
    return max((expiry - now).total_seconds(), 0.0) / (365.0 * 24 * 3600)


def _hours_open(pos: dict) -> float | None:
    if pos.get("hours_open") is not None:
        try:
            return max(float(pos["hours_open"]), 0.0)
        except (TypeError, ValueError):
            return None
    return 2.0


def _px(v):
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    if n <= 0:
        return None
    if n >= 5000:
        n = n / 100.0
    return n


def build_ticket(pos: dict, now: datetime | None = None) -> dict:
    now = now or datetime.now(IST)
    opt_type = OptionType.CALL if pos["option_type"] == "CE" else OptionType.PUT
    lot_size = int(pos["lot_size"])
    lots = int(pos["lots"])
    qty = lots * lot_size
    is_long = pos["side"].upper() == "LONG"
    position_side = Side.BUY if is_long else Side.SELL
    T = _years_to_expiry(pos["expiry"], now)
    F = float(pos["forward"] or 0)
    K = float(pos["strike"])
    bid, ask, ltp = _px(pos.get("bid")), _px(pos.get("ask")), _px(pos.get("ltp"))
    mark = ltp or (bid if is_long else ask) or bid or ask
    entry_price = float(pos["entry_price"])
    sign = 1 if is_long else -1
    points = (float(mark) - entry_price) * sign if mark else 0.0
    gross_pnl = points * qty
    net_mtm = net_if_exited_now(position_side, entry_price, mark, qty, FEE_TABLE) if mark else 0.0
    exit_charges = transaction_charges(Side.SELL if is_long else Side.BUY, mark or entry_price, qty, FEE_TABLE)
    entry_charges = transaction_charges(position_side, entry_price, qty, FEE_TABLE)

    sigma = implied_vol(F, K, T, RISK_FREE_RATE, opt_type, mark) if mark and T > 0 else None
    if sigma is None:
        sigma = float(pos.get("iv_atm") or 0.15)
    key = f"{pos.get('underlying')}-{pos.get('expiry')}-{int(K)}{pos['option_type']}"
    prev = _LAST_IV.get(key)
    iv_change = None if prev is None else sigma - prev
    _LAST_IV[key] = sigma

    if T > 0:
        g = greeks(F, K, sigma, T, RISK_FREE_RATE, opt_type)
        theta_per_hour = abs(g.theta) * qty / (252 * (375 / 60))
        signed_theta = theta_per_hour * (-1 if is_long else 1)
        greeks_out = {
            "delta": round(g.delta * qty * sign, 2),
            "gamma": round(g.gamma * qty * sign, 6),
            "theta_per_hour": round(signed_theta, 2),
            "vega_per_vol_point": round(g.vega * qty * sign / 100.0, 2),
        }
    else:
        signed_theta = 0.0
        greeks_out = {"delta": 0.0, "gamma": 0.0, "theta_per_hour": 0.0, "vega_per_vol_point": 0.0}

    hours_open = _hours_open(pos)
    theta_so_far = None if hours_open is None else round(signed_theta * hours_open, 2)
    target_net = pos.get("target_net")
    stop_loss = pos.get("stop_loss") or pos.get("max_loss")
    if target_net is None:
        target_net = 0.5 * entry_price * qty * sign
    else:
        target_net = float(target_net)
    sl = -abs(float(stop_loss)) if stop_loss is not None else None

    def exit_charges_fn(pxv: float) -> float:
        return transaction_charges(Side.SELL if is_long else Side.BUY, pxv, qty, FEE_TABLE).total

    points_to_target = {}
    if T > 0:
        for name, iv_mult in IV_SCENARIOS:
            try:
                solved_F = solve_required_forward(
                    target_signed_pnl_after_charges=target_net,
                    entry_price=entry_price, K=K, qty=qty, sign=sign,
                    sigma=max(sigma * iv_mult, 0.001), T_remaining=T, r=RISK_FREE_RATE,
                    opt_type=opt_type, exit_charges_fn=exit_charges_fn, F_guess=F or K,
                )
                points_to_target[name] = round(solved_F - F, 1)
            except ValueError:
                points_to_target[name] = None
    else:
        points_to_target = {name: None for name, _ in IV_SCENARIOS}

    oi = classify_oi(pos.get("ce_oi_change"), pos.get("pe_oi_change"))
    days = T * 365.0
    clf = classify_greeks(
        is_long=is_long,
        days_to_expiry=days,
        iv=sigma,
        iv_change=iv_change,
        delta=greeks_out["delta"],
        gamma=greeks_out["gamma"],
        theta_per_hour=signed_theta,
        oi_bias=oi.bias,
        net_now=net_mtm,
        stop_floor=sl,
    )
    return {
        "instrument": f"{pos['underlying']} {int(K)}{pos['option_type']}",
        "expiry": pos["expiry"],
        "lots": lots,
        "side": "LONG" if is_long else "SHORT",
        "entry_price": entry_price,
        "mark_price": None if mark is None else round(mark, 2),
        "points": round(points, 2),
        "gross_pnl": round(gross_pnl, 2),
        "net_pnl": round(net_mtm, 2),
        "net_if_exited_now": round(net_mtm, 2),
        "exit_charges": exit_charges.as_dict(),
        "entry_charges": entry_charges.as_dict(),
        "greeks": greeks_out,
        "iv": round(sigma, 4),
        "iv_change": None if iv_change is None else round(iv_change, 4),
        "theta_per_hour": round(signed_theta, 2),
        "hours_open": None if hours_open is None else round(hours_open, 2),
        "theta_so_far": theta_so_far,
        "points_to_target": points_to_target,
        "required_move_pts": points_to_target,
        "oi": {"bias": oi.bias, "ce_oi_change": oi.ce_oi_change, "pe_oi_change": oi.pe_oi_change, "reason": oi.reason},
        "plan": {"target_net": round(float(target_net), 2), "stop_loss": sl},
        "state": clf.state.value,
        "state_reason": clf.reason,
        "analysis": clf.analysis,
        "low_confidence": clf.low_confidence,
    }
