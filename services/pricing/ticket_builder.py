"""ticket_builder.py"""

from datetime import datetime, timedelta, timezone

from fee_engine import FeeTableVersion, Side, net_if_exited_now, transaction_charges
from black76 import (
    OptionType, price, greeks, expected_move_straddle, time_to_worthless_minutes,
    solve_required_forward,
)
from state_classifier import classify_long, classify_short
from oi_bias import classify_oi

IST = timezone(timedelta(hours=5, minutes=30))
FEE_TABLE = FeeTableVersion(version_label="angel-2026")
RISK_FREE_RATE = 0.065
IV_SCENARIOS = (("iv_minus_2pct", 0.98), ("iv_unchanged", 1.00), ("iv_plus_2pct", 1.02))


def _years_to_expiry(expiry_date_str: str, now: datetime) -> float:
    expiry = datetime.fromisoformat(expiry_date_str + "T15:30:00+05:30")
    return max((expiry - now).total_seconds(), 0.0) / (365.0 * 24 * 3600)


def _hours_open(pos: dict, now: datetime) -> float | None:
    if pos.get("hours_open") is not None:
        try:
            return max(float(pos["hours_open"]), 0.0)
        except (TypeError, ValueError):
            return None
    return None


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
    sigma = float(pos["iv_atm"] or 0.15)

    bid, ask, ltp = _px(pos.get("bid")), _px(pos.get("ask")), _px(pos.get("ltp"))
    mark = ltp or (bid if is_long else ask) or bid or ask
    exit_now = (bid if is_long else ask) or mark
    entry_price = float(pos["entry_price"])
    sign = 1 if is_long else -1
    points = (float(mark) - entry_price) * sign if mark is not None else 0.0
    gross_pnl = points * qty

    # Screen net = LTP MTM minus Angel round-trip (matches broker "net").
    net_mtm = net_if_exited_now(position_side, entry_price, mark, qty, FEE_TABLE) if mark else 0.0
    net_bid = net_if_exited_now(position_side, entry_price, exit_now, qty, FEE_TABLE) if exit_now else net_mtm
    exit_charges = transaction_charges(Side.SELL if is_long else Side.BUY, mark or entry_price, qty, FEE_TABLE)
    entry_charges = transaction_charges(position_side, entry_price, qty, FEE_TABLE)

    low_confidence_pricing = T <= 0
    if T > 0:
        theoretical_price = price(F, K, sigma, T, RISK_FREE_RATE, opt_type)
        g = greeks(F, K, sigma, T, RISK_FREE_RATE, opt_type)
        theta_per_hour = abs(g.theta) * qty / (252 * (375 / 60))
        ttw = time_to_worthless_minutes(F, K, sigma, T, RISK_FREE_RATE, opt_type, g.theta)
        greeks_out = {
            "delta": round(g.delta * qty * sign, 2),
            "gamma": round(g.gamma * qty * sign, 6),
            "theta_per_hour": round(theta_per_hour * (-1 if is_long else 1), 2),
            "vega_per_vol_point": round(g.vega * qty * sign / 100.0, 2),
        }
    else:
        theoretical_price, theta_per_hour, ttw = 0.0, 0.0, 0.0
        greeks_out = {"delta": 0.0, "gamma": 0.0, "theta_per_hour": 0.0, "vega_per_vol_point": 0.0}
        low_confidence_pricing = True

    hours_open = _hours_open(pos, now)
    signed_theta_hour = theta_per_hour * (-1 if is_long else 1)
    theta_so_far = None if hours_open is None else round(signed_theta_hour * hours_open, 2)
    expected_move = expected_move_straddle(float(pos.get("atm_ce_premium") or mark or 1), float(pos.get("atm_pe_premium") or mark or 1))

    target_net = pos.get("target_net")
    stop_loss = pos.get("stop_loss")
    if stop_loss is None and pos.get("max_loss") is not None:
        stop_loss = pos.get("max_loss")
    plan_inferred = target_net is None
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
    ticket = {
        "instrument": f"{pos['underlying']} {int(K)}{pos['option_type']}",
        "expiry": pos["expiry"],
        "lots": lots,
        "side": "LONG" if is_long else "SHORT",
        "entry_price": entry_price,
        "mark_price": None if mark is None else round(mark, 2),
        "points": round(points, 2),
        "gross_pnl": round(gross_pnl, 2),
        "net_pnl": round(net_mtm, 2),
        "net_if_exited_now": round(net_bid, 2),
        "exit_charges": exit_charges.as_dict(),
        "entry_charges": entry_charges.as_dict(),
        "no_live_bid_flag": bid is None if is_long else ask is None,
        "greeks": greeks_out,
        "theta_per_hour": round(signed_theta_hour, 2),
        "hours_open": None if hours_open is None else round(hours_open, 2),
        "theta_so_far": theta_so_far,
        "expected_move_pts": round(expected_move, 2),
        "time_to_worthless_min": round(ttw, 1) if ttw is not None else None,
        "theoretical_price_model": round(theoretical_price, 2),
        "low_confidence": low_confidence_pricing,
        "plan": {"target_net": round(float(target_net), 2), "stop_loss": sl, "is_inferred": plan_inferred},
        "points_to_target": points_to_target,
        "required_move_pts": points_to_target,
        "oi": {"bias": oi.bias, "ce_oi_change": oi.ce_oi_change, "pe_oi_change": oi.pe_oi_change, "window": "entry strike ±5", "reason": oi.reason},
    }
    if T <= 0:
        ticket["state"] = "dead"
        ticket["state_reason"] = "expiry has passed"
        ticket["low_confidence"] = True
        return ticket
    baseline = points_to_target.get("iv_unchanged")
    move = abs(baseline) if baseline is not None else float("inf")
    if is_long:
        classification = classify_long(net_now=net_mtm, stop_loss=sl, required_move_pts=move, expected_move_pts=expected_move, time_to_worthless_min=ttw)
    else:
        classification = classify_short(net_now=net_mtm, stop_loss=sl, adverse_move_pts=move, expected_move_pts=expected_move, time_to_worthless_min=ttw)
    ticket["state"] = classification.state.value
    ticket["state_reason"] = classification.reason
    ticket["low_confidence"] = ticket["low_confidence"] or classification.low_confidence
    return ticket
