import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from black76 import (
    OptionType, price, greeks, expected_move_straddle, expected_move_1sigma,
    solve_required_forward,
)
from fee_engine import FeeTableVersion, Side, transaction_charges

FT = FeeTableVersion(version_label="test-v1")


def test_put_call_parity():
    F, K, sigma, T, r = 24800.0, 24800.0, 0.14, 3 / 365, 0.065
    c = price(F, K, sigma, T, r, OptionType.CALL)
    p = price(F, K, sigma, T, r, OptionType.PUT)
    disc = pytest.approx((F - K) * pow(2.718281828, -r * T), rel=1e-6)
    # C - P = e^-rT (F - K)
    import math
    assert (c - p) == pytest.approx(math.exp(-r * T) * (F - K), rel=1e-6)


def test_atm_call_and_put_have_similar_delta_magnitude():
    F, K, sigma, T, r = 24800.0, 24800.0, 0.14, 5 / 365, 0.065
    gc = greeks(F, K, sigma, T, r, OptionType.CALL)
    gp = greeks(F, K, sigma, T, r, OptionType.PUT)
    assert gc.delta == pytest.approx(-gp.delta, abs=0.05)  # near ATM, roughly symmetric


def test_price_decreases_as_expiry_approaches_otm():
    F, K, sigma, r = 24800.0, 25200.0, 0.14, 0.065  # OTM call
    p_far = price(F, K, sigma, 5 / 365, r, OptionType.CALL)
    p_near = price(F, K, sigma, 1 / 365, r, OptionType.CALL)
    assert p_near < p_far


def test_theta_is_negative_for_long_otm_option_near_expiry():
    F, K, sigma, T, r = 24800.0, 25000.0, 0.14, 2 / 365, 0.065
    g = greeks(F, K, sigma, T, r, OptionType.CALL)
    assert g.theta < 0  # time decay erodes value


def test_expected_move_straddle_matches_sum():
    assert expected_move_straddle(118.0, 96.0) == 214.0


def test_expected_move_1sigma_scales_with_vol():
    F, T = 24800.0, 5 / 365
    low = expected_move_1sigma(F, 0.10, T)
    high = expected_move_1sigma(F, 0.20, T)
    assert high > low


def test_solver_recovers_a_known_target():
    """Round-trip: pick an F', read off the net it produces, then solve for it back."""
    F_now, K, sigma, T, r = 24800.0, 24800.0, 0.14, 3 / 365, 0.065
    entry_price = price(F_now, K, sigma, T, r, OptionType.CALL)
    qty, sign = 50, 1

    def exit_charges_fn(px):
        return transaction_charges(Side.SELL, px, qty, FT).total

    # ground truth: what net does F_now + 40 pts produce?
    F_target_truth = F_now + 40
    px_at_truth = price(F_target_truth, K, sigma, T, r, OptionType.CALL)
    net_truth = (px_at_truth - entry_price) * qty * sign - exit_charges_fn(px_at_truth)

    solved_F = solve_required_forward(
        target_signed_pnl_after_charges=net_truth,
        entry_price=entry_price, K=K, qty=qty, sign=sign,
        sigma=sigma, T_remaining=T, r=r, opt_type=OptionType.CALL,
        exit_charges_fn=exit_charges_fn, F_guess=F_now,
    )
    assert solved_F == pytest.approx(F_target_truth, abs=1.0)


def test_solver_unreachable_target_raises():
    F_now, K, sigma, T, r = 24800.0, 24800.0, 0.14, 3 / 365, 0.065
    entry_price = price(F_now, K, sigma, T, r, OptionType.CALL)

    def exit_charges_fn(px):
        return transaction_charges(Side.SELL, px, 50, FT).total

    with pytest.raises(ValueError):
        solve_required_forward(
            target_signed_pnl_after_charges=1e12,  # absurd target
            entry_price=entry_price, K=K, qty=50, sign=1,
            sigma=sigma, T_remaining=T, r=r, opt_type=OptionType.CALL,
            exit_charges_fn=exit_charges_fn, F_guess=F_now,
        )
