"""
Three-state classifier used in the v1 app.

  on_plan  (Safe)  — plan is still inside what this expiry is pricing
  at_risk          — plan is stretched vs expected move or vs SL
  dead             — plan is not reachable in remaining life / SL is gone

Thresholds are product constants. Tune here only.
"""

from dataclasses import dataclass
from enum import Enum


class PositionState(str, Enum):
    ON_PLAN = "on_plan"
    AT_RISK = "at_risk"
    DEAD = "dead"


DEFAULT_DEAD_MULTIPLE = 2.0
DEFAULT_LOW_TIME_MIN = 30.0
DEFAULT_SL_BURN = 0.80


@dataclass(frozen=True)
class Classification:
    state: PositionState
    low_confidence: bool
    reason: str


def classify(
    *,
    side: str,
    net_now: float,
    target_net: float | None,
    stop_loss: float | None,
    required_move_pts: float | None,
    expected_move_pts: float,
    time_to_worthless_min: float | None,
    target_reachable: bool,
    dead_multiple: float = DEFAULT_DEAD_MULTIPLE,
    low_time_min: float = DEFAULT_LOW_TIME_MIN,
    sl_burn: float = DEFAULT_SL_BURN,
) -> Classification:
    """
    Data rules
    ----------
    DEAD
      - target unreachable under IV unchanged, or
      - |required_move| > dead_multiple * expected_move, or
      - time_to_worthless < 30 min (longs), or
      - stop-loss is a positive number and net_now <= -abs(stop_loss)
        (long: loss at/through SL; short: same, SL is max loss in rupees)

    AT_RISK
      - |required_move| > expected_move, or
      - net_now <= -sl_burn * abs(stop_loss) when SL is set

    ON_PLAN (Safe)
      - otherwise: required move inside expected move, SL not burning, time left
    """
    low_confidence = time_to_worthless_min is None
    ttw = time_to_worthless_min if time_to_worthless_min is not None else float("inf")
    req = abs(required_move_pts) if required_move_pts is not None else None
    sl = abs(stop_loss) if stop_loss not in (None, 0) else None

    if sl is not None and net_now <= -sl:
        return Classification(
            PositionState.DEAD, low_confidence,
            f"net ₹{net_now:.0f} is through stop-loss ₹{sl:.0f}",
        )

    if not target_reachable or (req is not None and expected_move_pts > 0 and req > dead_multiple * expected_move_pts):
        detail = (
            f"required {req:.0f}pts > {dead_multiple:.0f}x expected {expected_move_pts:.0f}pts"
            if req is not None else "target unreachable at current IV"
        )
        return Classification(PositionState.DEAD, low_confidence, detail)

    if side.upper() == "LONG" and ttw < low_time_min:
        return Classification(
            PositionState.DEAD, low_confidence,
            f"time to worthless {ttw:.0f}min < {low_time_min:.0f}min",
        )

    if sl is not None and net_now <= -sl_burn * sl:
        return Classification(
            PositionState.AT_RISK, low_confidence,
            f"net ₹{net_now:.0f} has burned {sl_burn*100:.0f}% of stop-loss ₹{sl:.0f}",
        )

    if req is not None and req > expected_move_pts:
        return Classification(
            PositionState.AT_RISK, low_confidence,
            f"required move {req:.0f}pts > expected move {expected_move_pts:.0f}pts",
        )

    return Classification(
        PositionState.ON_PLAN, low_confidence,
        f"required move {req if req is not None else 0:.0f}pts ≤ expected {expected_move_pts:.0f}pts",
    )
