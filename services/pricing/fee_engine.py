"""
fee_engine.py — Indian NSE index-option transaction charge engine.

Pure function, no I/O, no globals besides the passed-in FeeTableVersion.
ALL DEFAULT_* rates below are PLACEHOLDERS. Verify against the current
NSE/SEBI circular and a real broker contract note before trusting output
shown to a user. STT and stamp duty rates in particular change with Union
Budget amendments — do not assume these are current.

GST rule (do not get this wrong): 18% GST applies ONLY to
(brokerage + exchange transaction charge + SEBI fee). GST is NEVER applied
to STT or stamp duty.
"""

from dataclasses import dataclass
from enum import Enum


class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


@dataclass(frozen=True)
class FeeTableVersion:
    """Mirrors the `fee_table_versions` DB row. One versioned snapshot of rates."""
    version_label: str

    # TODO-VERIFY: confirm against current broker contract note / NSE circular
    DEFAULT_BROKERAGE_FLAT: float = 20.0          # ₹ per executed order (flat-fee brokers)
    DEFAULT_BROKERAGE_PCT: float = 0.0003          # 0.03% of turnover, whichever is lower

    # TODO-VERIFY against current NSE circular
    DEFAULT_NSE_TXN_CHARGE_RATE: float = 0.0003503  # per unit turnover, both sides

    # TODO-VERIFY against current SEBI circular
    DEFAULT_SEBI_FEE_RATE: float = 0.0000010        # ₹10 per crore turnover, both sides

    # TODO-VERIFY: F&O options STT on SELL side premium — this rate has changed
    # via Union Budget before (e.g. 0.0625% -> 0.1% in 2023). Confirm current rate.
    DEFAULT_STT_SELL_OPTIONS_RATE: float = 0.001    # 0.1% of premium turnover, SELL only

    # TODO-VERIFY: stamp duty on options BUY side, per the 2020 amendment (uniform
    # across states for demat securities) — confirm current rate.
    DEFAULT_STAMP_DUTY_RATE: float = 0.00003        # 0.003% of premium turnover, BUY only

    GST_RATE: float = 0.18


@dataclass(frozen=True)
class ChargeBreakdown:
    brokerage: float
    exchange_txn: float
    sebi_fee: float
    stt: float
    stamp: float
    gst: float
    total: float

    def as_dict(self) -> dict:
        return {
            "brokerage": round(self.brokerage, 2),
            "exchange_txn": round(self.exchange_txn, 2),
            "sebi_fee": round(self.sebi_fee, 2),
            "stt": round(self.stt, 2),
            "stamp": round(self.stamp, 2),
            "gst": round(self.gst, 2),
            "total": round(self.total, 2),
        }


def transaction_charges(
    side: Side,
    premium_per_unit: float,
    qty: int,
    fee_table: FeeTableVersion,
) -> ChargeBreakdown:
    """
    Charges for ONE transaction (one leg, one fill). qty is total units
    (lots * lot_size), not lots.

    premium_per_unit must be the actual execution/estimate price per unit
    (e.g. bid for a long exit, ask for a short exit) — not the broker's MTM
    reference price.
    """
    if qty <= 0:
        raise ValueError("qty must be positive")
    if premium_per_unit < 0:
        raise ValueError("premium_per_unit cannot be negative")

    turnover = premium_per_unit * qty

    brokerage = min(fee_table.DEFAULT_BROKERAGE_FLAT, fee_table.DEFAULT_BROKERAGE_PCT * turnover)
    exchange_txn = turnover * fee_table.DEFAULT_NSE_TXN_CHARGE_RATE
    sebi_fee = turnover * fee_table.DEFAULT_SEBI_FEE_RATE

    stt = turnover * fee_table.DEFAULT_STT_SELL_OPTIONS_RATE if side == Side.SELL else 0.0
    stamp = turnover * fee_table.DEFAULT_STAMP_DUTY_RATE if side == Side.BUY else 0.0

    gst = fee_table.GST_RATE * (brokerage + exchange_txn + sebi_fee)

    total = brokerage + exchange_txn + sebi_fee + stt + stamp + gst

    return ChargeBreakdown(
        brokerage=brokerage,
        exchange_txn=exchange_txn,
        sebi_fee=sebi_fee,
        stt=stt,
        stamp=stamp,
        gst=gst,
        total=total,
    )


def net_if_exited_now(
    position_side: Side,       # BUY = currently long, SELL = currently short
    entry_price: float,
    exit_price: float,         # bid for long exit, ask for short exit — caller decides
    qty: int,
    fee_table: FeeTableVersion,
) -> float:
    """
    Decision-relevant net: entry charges are sunk cost and NOT deducted here.
    This answers "what do I bank incrementally if I exit right now" —
    not "what was my full round-trip P&L" (that belongs in Recap, post-close,
    compared against the contract note actual).
    """
    exit_side = Side.SELL if position_side == Side.BUY else Side.BUY
    sign = 1 if position_side == Side.BUY else -1

    gross = (exit_price - entry_price) * qty * sign
    exit_charges = transaction_charges(exit_side, exit_price, qty, fee_table).total

    return gross - exit_charges
