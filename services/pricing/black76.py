"""
black76.py — Black-76 pricer + Greeks for index options (Nifty), priced off the
forward F (futures price if the adapter provides it, else spot * e^((r-q)T)).

Used by BOTH the theta decomposition and the target solver, so they never
disagree with each other (spec requirement: "Greeks from broker if present,
else compute so solver and theta use the SAME model" — this module IS that
single source of truth; broker Greeks, if shown, are a secondary display-only
line, never fed into the solver).
"""

import math
from dataclasses import dataclass
from enum import Enum


class OptionType(str, Enum):
    CALL = "CE"
    PUT = "PE"


def _norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _norm_pdf(x: float) -> float:
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


@dataclass(frozen=True)
class Greeks:
    delta: float
    gamma: float
    vega: float     # per 1.0 (100%) change in vol; UI should divide by 100 for "per vol point"
    theta: float     # per year; UI converts to per-day / per-hour


def _d1_d2(F: float, K: float, sigma: float, T: float) -> tuple[float, float]:
    if T <= 0 or sigma <= 0:
        raise ValueError("T and sigma must be positive for Black-76")
    d1 = (math.log(F / K) + 0.5 * sigma * sigma * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    return d1, d2


def price(F: float, K: float, sigma: float, T: float, r: float, opt_type: OptionType) -> float:
    """Black-76 theoretical price. T in years, r continuously-compounded risk-free rate."""
    if T <= 0:
        # at/after expiry: intrinsic only
        intrinsic = max(F - K, 0.0) if opt_type == OptionType.CALL else max(K - F, 0.0)
        return intrinsic

    d1, d2 = _d1_d2(F, K, sigma, T)
    disc = math.exp(-r * T)
    if opt_type == OptionType.CALL:
        return disc * (F * _norm_cdf(d1) - K * _norm_cdf(d2))
    else:
        return disc * (K * _norm_cdf(-d2) - F * _norm_cdf(-d1))


def greeks(F: float, K: float, sigma: float, T: float, r: float, opt_type: OptionType) -> Greeks:
    if T <= 0:
        return Greeks(delta=0.0, gamma=0.0, vega=0.0, theta=0.0)

    d1, d2 = _d1_d2(F, K, sigma, T)
    disc = math.exp(-r * T)
    pdf_d1 = _norm_pdf(d1)

    # Black-76 theta has a clean shared form (unlike Black-Scholes, both call and
    # put theta reduce to r*price - decay_term, since F carries no own drift under
    # the forward measure): theta = r*price - e^(-rT)*F*n(d1)*sigma/(2*sqrt(T))
    decay_term = disc * F * pdf_d1 * sigma / (2 * math.sqrt(T))

    if opt_type == OptionType.CALL:
        delta = disc * _norm_cdf(d1)
        px = price(F, K, sigma, T, r, OptionType.CALL)
        theta = r * px - decay_term
    else:
        delta = -disc * _norm_cdf(-d1)
        px = price(F, K, sigma, T, r, OptionType.PUT)
        theta = r * px - decay_term

    gamma = disc * pdf_d1 / (F * sigma * math.sqrt(T))
    vega = disc * F * pdf_d1 * math.sqrt(T)

    return Greeks(delta=delta, gamma=gamma, vega=vega, theta=theta)


def expected_move_straddle(atm_ce_premium: float, atm_pe_premium: float) -> float:
    """Primary expected-move measure per spec: ATM CE + ATM PE premium, in points.
    UI copy: "what this expiry is pricing" — never framed as a prediction."""
    return atm_ce_premium + atm_pe_premium


def expected_move_1sigma(F: float, sigma_atm: float, T: float) -> float:
    """Secondary measure: Black-76 1-sigma move."""
    return F * sigma_atm * math.sqrt(T)


def solve_required_forward(
    target_signed_pnl_after_charges: float,
    entry_price: float,
    K: float,
    qty: int,
    sign: int,                # +1 long, -1 short
    sigma: float,
    T_remaining: float,
    r: float,
    opt_type: OptionType,
    exit_charges_fn,          # callable: exit_price -> exit charges (₹), from fee_engine
    F_guess: float,
    tol: float = 1e-4,
    max_iter: int = 100,
) -> float:
    """
    Numeric root-find (bisection) for the forward price F' such that:
        (price(F', sigma, T_remaining) - entry_price) * qty * sign - exit_charges_fn(price(F')) 
            == target_signed_pnl_after_charges

    Returns required F'. Caller computes required_points = F' - F_now.
    Bisection is used (not Newton) because exit_charges_fn can have a kink
    (brokerage min()) that makes the derivative unstable near it.
    """
    def net_at(F: float) -> float:
        px = price(F, K, sigma, T_remaining, r, opt_type)
        exit_charges = exit_charges_fn(px)
        return (px - entry_price) * qty * sign - exit_charges

    lo, hi = max(F_guess * 0.5, 1.0), F_guess * 1.5
    f_lo, f_hi = net_at(lo) - target_signed_pnl_after_charges, net_at(hi) - target_signed_pnl_after_charges

    # expand bracket if needed (bounded attempts)
    expand_iter = 0
    while f_lo * f_hi > 0 and expand_iter < 20:
        lo *= 0.7
        hi *= 1.3
        f_lo, f_hi = net_at(lo) - target_signed_pnl_after_charges, net_at(hi) - target_signed_pnl_after_charges
        expand_iter += 1

    if f_lo * f_hi > 0:
        raise ValueError("Could not bracket a solution for target — check inputs (target may be unreachable)")

    for _ in range(max_iter):
        mid = (lo + hi) / 2
        f_mid = net_at(mid) - target_signed_pnl_after_charges
        if abs(f_mid) < tol or (hi - lo) < 1e-6:
            return mid
        if f_lo * f_mid < 0:
            hi, f_hi = mid, f_mid
        else:
            lo, f_lo = mid, f_mid

    return (lo + hi) / 2


def time_to_worthless_minutes(
    F: float, K: float, sigma: float, T_remaining: float, r: float, opt_type: OptionType,
    theta_per_year: float, minutes_per_year: float = 252 * 375,
) -> float | None:
    """
    Rough model estimate: minutes until theoretical extrinsic value decays to
    ~0 at the CURRENT instantaneous theta (flat-price-path assumption — labeled
    "model" in the UI, never presented as a prediction of price).
    Returns None if already worthless or theta is ~0 (can't estimate).
    """
    current_price = price(F, K, sigma, T_remaining, r, opt_type)
    intrinsic = max(F - K, 0.0) if opt_type == OptionType.CALL else max(K - F, 0.0)
    extrinsic = current_price - intrinsic

    if extrinsic <= 0:
        return 0.0
    theta_per_minute = abs(theta_per_year) / minutes_per_year
    if theta_per_minute <= 1e-9:
        return None

    return extrinsic / theta_per_minute
