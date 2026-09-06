"""
Open-interest bias from a ±5-strike window around the entry strike.

Retail chain heuristic (documented, not a prediction):
  PE OI build relative to CE OI build → support / bullish tilt
  CE OI build relative to PE OI build → resistance / bearish tilt
  Otherwise neutral.

Inputs are *changes since entry* already summed by the caller over 10 strikes
(entry ±5). This module does not fetch the chain.
"""

from dataclasses import dataclass

NEUTRAL_RATIO = 1.15  # need 15% more build on one side to call a tilt


@dataclass(frozen=True)
class OIBias:
    bias: str  # bullish | bearish | neutral
    ce_oi_change: float
    pe_oi_change: float
    reason: str


def classify_oi(ce_oi_change: float | None, pe_oi_change: float | None) -> OIBias:
    if ce_oi_change is None or pe_oi_change is None:
        return OIBias(
            "neutral", 0.0, 0.0,
            "OI change since entry not supplied — window is entry strike ±5 (10 strikes).",
        )

    ce = float(ce_oi_change)
    pe = float(pe_oi_change)
    # Floor at 0 for the ratio so covering/unwinds don't invert the label alone.
    ce_build = max(ce, 0.0)
    pe_build = max(pe, 0.0)

    if pe_build > ce_build * NEUTRAL_RATIO and pe_build > 0:
        return OIBias(
            "bullish", ce, pe,
            f"PE OI in the ±5-strike window rose more than CE OI since entry "
            f"(PE {pe:.0f} vs CE {ce:.0f}).",
        )
    if ce_build > pe_build * NEUTRAL_RATIO and ce_build > 0:
        return OIBias(
            "bearish", ce, pe,
            f"CE OI in the ±5-strike window rose more than PE OI since entry "
            f"(CE {ce:.0f} vs PE {pe:.0f}).",
        )
    return OIBias(
        "neutral", ce, pe,
        f"CE/PE OI change in the ±5-strike window is balanced (CE {ce:.0f}, PE {pe:.0f}).",
    )
