"""
ticket_builder.py — one position record → ticket for the app surface.
"""

from datetime import datetime, timedelta, timezone

from fee_engine import FeeTableVersion, Side, net_if_exited_now, transaction_charges
from black76 import (
    OptionType, price, greeks, expected_move_straddle, time_to_worthless_minutes,
    solve_required_forward,
)
from state_classifier import classify_long, classify_short
from oi_bias import classify_oi

IST = timezone(timedelta(hours=5, minutes=30))
FEE_TABLE = FeeTableVersion(version_label="v1")
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
    if pos.get("entry_time"):
        try:
            raw = str(pos["entry_time"]).replace("Z", "+00:00")
            entered = datetime.fromisoformat(raw)
            if entered.tzinfo is None:
                entered = entered.replace(tzinfo=IST)
            return max((now - entered).total_seconds() / 3600.0, 0.0)
        except ValueError:
            return None
    return None


def build_ticket(pos: dict, now: datetime | None = None) -> dict:
    now = now or datetime.now(IST)

    opt_type = OptionType.CALL if pos["option_type"] == "CE" else OptionType.PUT
    lot_size = int(pos["lot_size"])
    lots = int(pos["lots"])
    qty = lots * lot_size
    is_long = pos["side"].upper() == "LONG"
    position_side = Side.BUY if is_long else Side.SELL

    T = _years_to_expiry(pos["expiry"], now)
    F = float(pos["forward"])
    K = float(pos["strike"])
    sigma = float(pos["iv_atm"])

    bid, ask, ltp = pos.get("bid"), pos.get("ask"), pos.get("ltp")
    mark_ltp = ltp if ltp is not None else (bid if is_long else ask)
    exit_price = (bid if is_long else ask)
    no_live_bid = exit_price is None
    if no_live_bid:
        exit_price = ltp

    entry_price = float(pos["entry_price"])
    sign = 1 if is_long else -1
    gross_pnl = (float(mark_ltp) - entry_price) * qty * sign if mark_ltp is not None else 0.0
    net_now = net_if_exited_now(position_side, entry_price, exit_price, qty, FEE_TABLE)
    exit_charges = transaction_charges(
        Side.SELL if is_long else Side.BUY, exit_price, qty, FEE_TABLE
    )

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
    # Longs lose premium to theta; shorts receive it.
    signed_theta_hour = theta_per_hour * (-1 if is_long else 1)
    theta_so_far = None if hours_open is None else round(signed_theta_hour * hours_open, 2)

    expected_move = expected_move_straddle(float(pos["atm_ce_premium"]), float(pos["atm_pe_premium"]))

    target_net = pos.get("target_net")
    stop_loss = pos.get("stop_loss")
    if stop_loss is None:
        stop_loss = pos.get("max_loss")
        if stop_loss is not None and is_long is False:
            stop_loss = -abs(float(stop_loss))
        elif stop_loss is not None and is_long:
            stop_loss = -abs(float(stop_loss))

    plan_inferred = target_net is None
    if target_net is None:
        target_net = 0.5 * entry_price * qty * sign
    else:
        target_net = float(target_net)

    sl = float(stop_loss) if stop_loss is not None else None

    def exit_charges_fn(px: float) -> float:
        return transaction_charges(Side.SELL if is_long else Side.BUY, px, qty, FEE_TABLE).total

    points_to_target = {}
    if T > 0:
        for name, iv_mult in IV_SCENARIOS:
            try:
                solved_F = solve_required_forward(
                    target_signed_pnl_after_charges=target_net,
                    entry_price=entry_price, K=K, qty=qty, sign=sign,
                    sigma=max(sigma * iv_mult, 0.001), T_remaining=T, r=RISK_FREE_RATE,
                    opt_type=opt_type, exit_charges_fn=exit_charges_fn, F_guess=F,
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
        "gross_pnl": round(gross_pnl, 2),
        "net_pnl": round(net_now, 2),
        "net_if_exited_now": round(net_now, 2),
        "exit_charges": exit_charges.as_dict(),
        "no_live_bid_flag": no_live_bid,
        "greeks": greeks_out,
        "theta_per_hour": round(signed_theta_hour, 2),
        "hours_open": None if hours_open is None else round(hours_open, 2),
        "theta_so_far": theta_so_far,
        "expected_move_pts": round(expected_move, 2),
        "time_to_worthless_min": round(ttw, 1) if ttw is not None else None,
        "theoretical_price_model": round(theoretical_price, 2),
        "low_confidence": low_confidence_pricing,
        "plan": {
            "target_net": round(float(target_net), 2),
            "stop_loss": None if sl is None else round(sl, 2),
            "is_inferred": plan_inferred,
        },
        "points_to_target": points_to_target,
        "required_move_pts": points_to_target,
        "oi": {
            "bias": oi.bias,
            "ce_oi_change": oi.ce_oi_change,
            "pe_oi_change": oi.pe_oi_change,
            "window": "entry strike ±5 (10 strikes)",
            "reason": oi.reason,
        },
    }

    if T <= 0:
        ticket["state"] = "dead"
        ticket["state_reason"] = "expiry has passed or T<=0"
        ticket["low_confidence"] = True
        return ticket

    baseline = points_to_target.get("iv_unchanged")
    move = abs(baseline) if baseline is not None else float("inf")

    if is_long:
        classification = classify_long(
            net_now=net_now,
            stop_loss=sl,
            required_move_pts=move,
            expected_move_pts=expected_move,
            time_to_worthless_min=ttw,
        )
    else:
        classification = classify_short(
            net_now=net_now,
            stop_loss=sl,
            adverse_move_pts=move,
            expected_move_pts=expected_move,
            time_to_worthless_min=ttw,
        )

    ticket["state"] = classification.state.value
    ticket["state_reason"] = classification.reason
    ticket["low_confidence"] = ticket["low_confidence"] or classification.low_confidence
    return ticket
