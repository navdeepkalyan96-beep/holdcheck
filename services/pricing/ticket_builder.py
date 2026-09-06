"""Build a v1 ticket: gross/net PnL, theta so far, IV scenarios, OI, 3-state."""

from datetime import datetime, timedelta, timezone

from fee_engine import FeeTableVersion, Side, net_if_exited_now, transaction_charges
from black76 import (
    OptionType, price, greeks, expected_move_straddle, time_to_worthless_minutes,
    solve_required_forward,
)
from state_classifier import classify
from oi_bias import parse_oi_ladder, classify_oi

IST = timezone(timedelta(hours=5, minutes=30))
FEE_TABLE = FeeTableVersion(version_label="v1")
RISK_FREE_RATE = 0.065
IV_SCENARIOS = (("iv_minus_2", -0.02), ("iv_unchanged", 0.0), ("iv_plus_2", 0.02))


def _years_to_expiry(expiry_date_str: str, now: datetime) -> float:
    expiry = datetime.fromisoformat(expiry_date_str + "T15:30:00+05:30")
    return max((expiry - now).total_seconds(), 0.0) / (365.0 * 24 * 3600)


def _hours_held(pos: dict, now: datetime) -> float | None:
    if pos.get("hours_held") not in (None, ""):
        return float(pos["hours_held"])
    raw = pos.get("entry_time")
    if not raw:
        return None
    try:
        et = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        if et.tzinfo is None:
            et = et.replace(tzinfo=IST)
        return max((now - et).total_seconds(), 0.0) / 3600.0
    except ValueError:
        return None


def _required_move_greeks(g, d_sigma: float, target_premium_change: float) -> float | None:
    """Solve delta dF + 0.5 gamma dF^2 + vega d_sigma = target_premium_change."""
    # a x^2 + b x + c = 0
    a = 0.5 * g.gamma
    b = g.delta
    c = g.vega * d_sigma - target_premium_change
    if abs(a) < 1e-12:
        if abs(b) < 1e-12:
            return None
        return -c / b
    disc = b * b - 4 * a * c
    if disc < 0:
        return None
    root1 = (-b + disc ** 0.5) / (2 * a)
    root2 = (-b - disc ** 0.5) / (2 * a)
    # pick the smaller-magnitude live move
    return root1 if abs(root1) <= abs(root2) else root2


def build_ticket(pos: dict, now: datetime | None = None) -> dict:
    now = now or datetime.now(IST)

    opt_type = OptionType.CALL if pos["option_type"] == "CE" else OptionType.PUT
    lot_size = int(pos["lot_size"])
    lots = int(pos["lots"])
    qty = lots * lot_size
    is_long = pos["side"].upper() == "LONG"
    position_side = Side.BUY if is_long else Side.SELL
    sign = 1 if is_long else -1

    T = _years_to_expiry(pos["expiry"], now)
    F = float(pos["forward"])
    K = float(pos["strike"])
    sigma = float(pos["iv_atm"])

    bid, ask, ltp = pos.get("bid"), pos.get("ask"), pos.get("ltp")
    mark = ltp if ltp is not None else (bid if is_long else ask)
    exit_price = (bid if is_long else ask)
    no_live_bid = exit_price is None
    if no_live_bid:
        exit_price = ltp if ltp is not None else mark

    entry_price = float(pos["entry_price"])
    gross_now = (float(exit_price) - entry_price) * qty * sign
    net_now = net_if_exited_now(position_side, entry_price, exit_price, qty, FEE_TABLE)
    exit_charges = transaction_charges(
        Side.SELL if is_long else Side.BUY, exit_price, qty, FEE_TABLE
    )

    g = greeks(F, K, sigma, T, RISK_FREE_RATE, opt_type) if T > 0 else None
    theoretical_price = price(F, K, sigma, T, RISK_FREE_RATE, opt_type) if T > 0 else 0.0
    if g and T > 0:
        theta_per_hour = abs(g.theta) * qty / (252 * (375 / 60))
        ttw = time_to_worthless_minutes(F, K, sigma, T, RISK_FREE_RATE, opt_type, g.theta)
    else:
        theta_per_hour, ttw = 0.0, 0.0

    hours = _hours_held(pos, now)
    # longs lose theta; shorts earn it
    theta_so_far = None
    if hours is not None:
        theta_so_far = round((-theta_per_hour if is_long else theta_per_hour) * hours, 2)

    expected_move = expected_move_straddle(float(pos["atm_ce_premium"]), float(pos["atm_pe_premium"]))

    target_net = pos.get("target_net")
    stop_loss = pos.get("stop_loss") if pos.get("stop_loss") not in (None, "") else pos.get("max_loss")
    if target_net in ("", None):
        target_net = None
    else:
        target_net = float(target_net)
    if stop_loss in ("", None):
        stop_loss = None
    else:
        stop_loss = float(stop_loss)

    def exit_charges_fn(px: float) -> float:
        return transaction_charges(Side.SELL if is_long else Side.BUY, px, qty, FEE_TABLE).total

    required = {}
    required_greeks = {}
    if T > 0 and target_net is not None and g is not None:
        premium_needed = target_net / max(qty * sign if sign else 1, 1) if is_long else -target_net / qty
        # For shorts, "target" is usually remaining credit; we interpret target_net as
        # desired signed PnL after charges for both sides.
        target_premium_change = (target_net / qty) * sign + (entry_price - theoretical_price) * 0
        # Want change in option price such that signed qty * dP ~= (target_net - gross_now)
        dP_needed = (target_net - gross_now) / (qty * sign) if sign else None
        for name, d_sig in IV_SCENARIOS:
            sig = max(sigma + d_sig, 0.001)
            try:
                solved_F = solve_required_forward(
                    target_signed_pnl_after_charges=target_net,
                    entry_price=entry_price, K=K, qty=qty, sign=sign,
                    sigma=sig, T_remaining=T, r=RISK_FREE_RATE, opt_type=opt_type,
                    exit_charges_fn=exit_charges_fn, F_guess=F,
                )
                required[name] = round(solved_F - F, 1)
            except ValueError:
                required[name] = None
            if dP_needed is not None:
                approx = _required_move_greeks(g, d_sig, dP_needed)
                required_greeks[name] = round(approx, 1) if approx is not None else None
    elif T > 0:
        for name, _ in IV_SCENARIOS:
            required[name] = None
            required_greeks[name] = None

    oi = classify_oi(parse_oi_ladder(pos.get("oi_ladder")))

    rmp = required.get("iv_unchanged")
    reachable = rmp is not None or (target_net is None)
    classification = classify(
        side=pos["side"],
        net_now=net_now,
        target_net=target_net,
        stop_loss=stop_loss,
        required_move_pts=rmp,
        expected_move_pts=expected_move,
        time_to_worthless_min=ttw if T > 0 else 0.0,
        target_reachable=True if target_net is None else rmp is not None,
    )

    return {
        "instrument": f"{pos['underlying']} {int(K)}{pos['option_type']}",
        "expiry": pos["expiry"],
        "lots": lots,
        "side": "LONG" if is_long else "SHORT",
        "entry_price": entry_price,
        "gross_pnl": round(gross_now, 2),
        "net_pnl": round(net_now, 2),
        "net_if_exited_now": round(net_now, 2),
        "exit_charges": exit_charges.as_dict(),
        "no_live_bid_flag": no_live_bid,
        "theta_per_hour": round(theta_per_hour, 2),
        "theta_so_far": theta_so_far,
        "hours_held": hours,
        "expected_move_pts": round(expected_move, 2),
        "time_to_worthless_min": round(ttw, 1) if ttw is not None else None,
        "theoretical_price_model": round(theoretical_price, 2),
        "greeks": None if g is None else {
            "delta": round(g.delta, 4),
            "gamma": round(g.gamma, 6),
            "theta_per_year": round(g.theta, 4),
            "vega": round(g.vega, 4),
        },
        "required_move_pts": required,
        "required_move_pts_greeks": required_greeks,
        "plan": {
            "target_net": target_net,
            "stop_loss": stop_loss,
            "is_inferred": target_net is None and stop_loss is None,
        },
        "oi": {
            "bias": oi.bias,
            "d_ce": oi.d_ce,
            "d_pe": oi.d_pe,
            "window_strikes": oi.window_strikes,
            "reason": oi.reason,
        },
        "state": classification.state.value,
        "state_reason": classification.reason,
        "low_confidence": classification.low_confidence or T <= 0 or no_live_bid,
    }
