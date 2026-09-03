import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fee_engine import FeeTableVersion, Side, transaction_charges, net_if_exited_now

FT = FeeTableVersion(version_label="test-v1")


def test_stt_only_on_sell():
    buy = transaction_charges(Side.BUY, 100.0, 25, FT)
    sell = transaction_charges(Side.SELL, 100.0, 25, FT)
    assert buy.stt == 0.0
    assert sell.stt > 0.0


def test_stamp_only_on_buy():
    buy = transaction_charges(Side.BUY, 100.0, 25, FT)
    sell = transaction_charges(Side.SELL, 100.0, 25, FT)
    assert buy.stamp > 0.0
    assert sell.stamp == 0.0


def test_gst_excludes_stt_and_stamp():
    turnover = 100.0 * 25
    b = transaction_charges(Side.SELL, 100.0, 25, FT)
    expected_gst_base = b.brokerage + b.exchange_txn + b.sebi_fee
    assert b.gst == pytest.approx(FT.GST_RATE * expected_gst_base, rel=1e-9)
    # sanity: gst must NOT equal 18% of (base + stt) — would be a bug
    assert b.gst != pytest.approx(FT.GST_RATE * (expected_gst_base + b.stt), rel=1e-9)


def test_brokerage_is_capped_flat_or_pct_whichever_lower():
    # tiny turnover -> pct brokerage should be below flat, so min() picks pct
    tiny = transaction_charges(Side.BUY, 1.0, 1, FT)
    assert tiny.brokerage == pytest.approx(FT.DEFAULT_BROKERAGE_PCT * 1.0, rel=1e-9)
    # large turnover -> flat should win
    big = transaction_charges(Side.BUY, 100000.0, 100, FT)
    assert big.brokerage == pytest.approx(FT.DEFAULT_BROKERAGE_FLAT, rel=1e-9)


def test_total_sums_components():
    b = transaction_charges(Side.SELL, 142.0, 50, FT)
    assert b.total == pytest.approx(
        b.brokerage + b.exchange_txn + b.sebi_fee + b.stt + b.stamp + b.gst, rel=1e-9
    )


def test_net_if_exited_now_long_winner_deducts_only_exit_charges():
    qty = 50
    entry, exit_bid = 100.0, 130.0
    net = net_if_exited_now(Side.BUY, entry, exit_bid, qty, FT)
    gross = (exit_bid - entry) * qty
    assert net < gross  # charges reduce it
    assert net > gross - 100  # but charges are a small fraction, sanity bound


def test_net_if_exited_now_short_uses_ask_and_inverted_sign():
    qty = 50
    entry, exit_ask = 100.0, 70.0  # short profits when price falls
    net = net_if_exited_now(Side.SELL, entry, exit_ask, qty, FT)
    gross = (entry - exit_ask) * qty
    assert net < gross
    assert net > 0  # still profitable after charges in this example


def test_rejects_negative_qty():
    with pytest.raises(ValueError):
        transaction_charges(Side.BUY, 100.0, -5, FT)
