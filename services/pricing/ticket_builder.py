"""
ticket_builder.py — builds a computed ticket dict from one position record.
Uses the FULL numeric solver (black76.solve_required_forward), unlike the
earlier mock_to_ticket.py demo which used a quick delta-based approximation.
"""

from datetime import datetime, timedelta, timezone

from fee_engine import FeeTableVersion, Side, net_if_exited_now, transaction_charges
from black76 import (
    OptionType, price, greeks, expected_move_straddle, time_to_worthless_minutes,
    solve_required_forward,
)
from state_classifier import classify_buyer, classify_seller

IST = timezone(timedelta(hours=5, minutes=30))
FEE_TABLE = FeeTableVersion(version_label="v1")
RISK_FREE_RATE = 0.065  # TODO-VERIFY: current short-term rate proxy


def _years_to_expiry(expiry_date_str: str, now: datetime) -> float:
    expiry = datetime.fromisoformat(expiry_date_str + "T15:30:00+05:30")
    delta_seconds = (expiry - now).total_seconds()
    return max(delta_seconds, 0.0) / (365.0 * 24 * 3600)


def build_ticket(pos: dict, now: datetime | None = None) -> dict:
    """
    pos: {
      underlying, expiry, strike, option_type ('CE'/'PE'), lot_size,
      side ('LONG'/'SHORT'), lots, entry_price,
      ltp, bid, ask,                      # bid/ask may be missing -> fallback to ltp
      iv_atm, atm_ce_premium, atm_pe_premium, forward,
      target_net (optional, long only), max_loss (optional, short only),
    }
    """
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
    exit_price = (bid if is_long else ask)
    no_live_bid = exit_price is None
    if no_live_bid:
        exit_price = ltp

    entry_price = float(pos["entry_price"])
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
    else:
        theoretical_price, theta_per_hour, ttw = 0.0, 0.0, 0.0
        low_confidence_pricing = True

    expected_move = expected_move_straddle(float(pos["atm_ce_premium"]), float(pos["atm_pe_premium"]))

    ticket = {
        "instrument": f"{pos['underlying']} {int(K)}{pos['option_type']}",
        "expiry": pos["expiry"],
        "lots": lots,
        "side": "LONG" if is_long else "SHORT",
        "entry_price": entry_price,
        "net_if_exited_now": round(net_now, 2),
        "exit_charges": exit_charges.as_dict(),
        "no_live_bid_flag": no_live_bid,
        "theta_per_hour": round(theta_per_hour, 2),
        "expected_move_pts": round(expected_move, 2),
        "time_to_worthless_min": round(ttw, 1) if ttw is not None else None,
        "theoretical_price_model": round(theoretical_price, 2),
        "low_confidence": low_confidence_pricing,
    }

    def exit_charges_fn(px: float) -> float:
        return transaction_charges(Side.SELL if is_long else Side.BUY, px, qty, FEE_TABLE).total

    if T <= 0:
        ticket["state"] = "dead"
        ticket["state_reason"] = "expiry has passed or T<=0"
        ticket["required_move_pts"] = None
        ticket["low_confidence"] = True
        return ticket

    if is_long:
        plan_target = pos.get("target_net")
        is_inferred = plan_target is None
        target_net = float(plan_target) if plan_target is not None else 0.5 * entry_price * qty

        sign = 1
        required_move_pts = {}
        for scenario_name, sigma_scenario in [("iv_unchanged", sigma), ("iv_crush_minus_2", max(sigma - 0.02, 0.001))]:
            try:
                solved_F = solve_required_forward(
                    target_signed_pnl_after_charges=target_net,
                    entry_price=entry_price, K=K, qty=qty, sign=sign,
                    sigma=sigma_scenario, T_remaining=T, r=RISK_FREE_RATE, opt_type=opt_type,
                    exit_charges_fn=exit_charges_fn, F_guess=F,
                )
                required_move_pts[scenario_name] = round(solved_F - F, 1)
            except ValueError:
                required_move_pts[scenario_name] = None  # target unreachable in this scenario

        ticket["plan"] = {"target_net": round(target_net, 2), "is_inferred": is_inferred}
        ticket["required_move_pts"] = required_move_pts

        rmp = required_move_pts["iv_unchanged"]
        classification = classify_buyer(
            net_now=net_now,
            target_net=target_net,
            required_move_pts=abs(rmp) if rmp is not None else float("inf"),
            expected_move_pts=expected_move,
            time_to_worthless_min=ttw,
        )
        ticket["state"] = classification.state.value
        ticket["state_reason"] = classification.reason
        ticket["low_confidence"] = ticket["low_confidence"] or classification.low_confidence

    else:
        plan_max_loss = pos.get("max_loss")
        is_inferred = plan_max_loss is None
        max_loss = float(plan_max_loss) if plan_max_loss is not None else 0.5 * entry_price * qty

        sign = -1
        try:
            solved_F = solve_required_forward(
                target_signed_pnl_after_charges=-max_loss,
                entry_price=entry_price, K=K, qty=qty, sign=sign,
                sigma=sigma, T_remaining=T, r=RISK_FREE_RATE, opt_type=opt_type,
                exit_charges_fn=exit_charges_fn, F_guess=F,
            )
            adverse_move_pts = abs(solved_F - F)
        except ValueError:
            adverse_move_pts = float("inf")

        current_loss = max(-net_now, 0.0)
        ticket["plan"] = {"max_loss": round(max_loss, 2), "is_inferred": is_inferred}
        ticket["required_move_pts"] = {"adverse_move_to_max_loss": round(adverse_move_pts, 1)}

        classification = classify_seller(
            current_loss=current_loss,
            max_loss=max_loss,
            adverse_move_pts=adverse_move_pts,
            expected_move_pts=expected_move,
            time_to_worthless_min=ttw,
        )
        ticket["state"] = classification.state.value
        ticket["state_reason"] = classification.reason
        ticket["low_confidence"] = ticket["low_confidence"] or classification.low_confidence

    return ticket
