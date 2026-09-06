"""NSE index-option charges — Angel One flat brokerage + statutory rates 2026."""

from dataclasses import dataclass
from enum import Enum


class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


@dataclass(frozen=True)
class FeeTableVersion:
    version_label: str = "angel-2026"
    # Angel One F&O options: flat ₹20 per executed order
    DEFAULT_BROKERAGE_FLAT: float = 20.0
    DEFAULT_NSE_TXN_CHARGE_RATE: float = 0.0003503  # 0.03503% of premium
    DEFAULT_SEBI_FEE_RATE: float = 0.0000010        # ₹10 / crore
    DEFAULT_STT_SELL_OPTIONS_RATE: float = 0.001    # 0.10% premium, SELL only
    DEFAULT_STAMP_DUTY_RATE: float = 0.00003        # 0.003% premium, BUY only
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


def transaction_charges(side: Side, premium_per_unit: float, qty: int, fee_table: FeeTableVersion) -> ChargeBreakdown:
    if qty <= 0:
        raise ValueError("qty must be positive")
    px = max(float(premium_per_unit or 0), 0.0)
    turnover = px * qty
    brokerage = fee_table.DEFAULT_BROKERAGE_FLAT
    exchange_txn = turnover * fee_table.DEFAULT_NSE_TXN_CHARGE_RATE
    sebi_fee = turnover * fee_table.DEFAULT_SEBI_FEE_RATE
    stt = turnover * fee_table.DEFAULT_STT_SELL_OPTIONS_RATE if side == Side.SELL else 0.0
    stamp = turnover * fee_table.DEFAULT_STAMP_DUTY_RATE if side == Side.BUY else 0.0
    gst = fee_table.GST_RATE * (brokerage + exchange_txn + sebi_fee)
    total = brokerage + exchange_txn + sebi_fee + stt + stamp + gst
    return ChargeBreakdown(brokerage, exchange_txn, sebi_fee, stt, stamp, gst, total)


def net_if_exited_now(position_side: Side, entry_price: float, exit_price: float, qty: int, fee_table: FeeTableVersion) -> float:
    exit_side = Side.SELL if position_side == Side.BUY else Side.BUY
    sign = 1 if position_side == Side.BUY else -1
    gross = (exit_price - entry_price) * qty * sign
    exit_charges = transaction_charges(exit_side, exit_price, qty, fee_table).total
    entry_charges = transaction_charges(position_side, entry_price, qty, fee_table).total
    return gross - exit_charges - entry_charges
