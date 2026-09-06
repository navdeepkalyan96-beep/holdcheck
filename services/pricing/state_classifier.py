"""
Three-state classifier: Safe (on plan) / At risk / Dead.

Criteria are numeric only. Labels are descriptions of the book vs the user's
plan (target + stop), expected move, and remaining life. They are not orders.
"""

from dataclasses import dataclass
from enum import Enum


class PositionState(str, Enum):
    SAFE = "safe"
    AT_RISK = "at_risk"
    DEAD = "dead"


# Named product thresholds — tune here only.
DEAD_MOVE_MULTIPLE = 2.0          # required/adverse vs expected
AT_RISK_MOVE_MULTIPLE = 1.0       # above expected → at risk
LOW_TIME_MIN = 30.0               # minutes of model life left
STOP_HIT_BUFFER = 0.0             # net at or through SL → dead


@dataclass(frozen=True)
class Classification:
    state: PositionState
    low_confidence: bool
    reason: str


def classify_long(
    net_now: float,
    stop_loss: float | None,
    required_move_pts: float,
    expected_move_pts: float,
    time_to_worthless_min: float | None,
) -> Classification:
    """
    Long premium:
      Dead    — SL hit, or required move > 2× expected, or < 30 min of model life.
      At risk — required move > expected (plan asks more than the straddle prices).
      Safe    — required ≤ expected, SL not hit, enough time left.
    """
    low_confidence = time_to_worthless_min is None
    ttw = time_to_worthless_min if time_to_worthless_min is not None else float("inf")

    if stop_loss is not None and net_now <= stop_loss:
        return Classification(
            PositionState.DEAD, low_confidence,
            f"net now (₹{net_now:.0f}) is at or through stop (₹{stop_loss:.0f})",
        )

    if required_move_pts > DEAD_MOVE_MULTIPLE * expected_move_pts or ttw < LOW_TIME_MIN:
        return Classification(
            PositionState.DEAD, low_confidence,
            f"required move ({required_move_pts:.0f}pts) > {DEAD_MOVE_MULTIPLE:.0f}× expected "
            f"({expected_move_pts:.0f}pts), or model life < {LOW_TIME_MIN:.0f}min",
        )

    if required_move_pts > AT_RISK_MOVE_MULTIPLE * expected_move_pts:
        return Classification(
            PositionState.AT_RISK, low_confidence,
            f"required move ({required_move_pts:.0f}pts) > expected move ({expected_move_pts:.0f}pts)",
        )

    return Classification(
        PositionState.SAFE, low_confidence,
        f"required move ({required_move_pts:.0f}pts) ≤ expected ({expected_move_pts:.0f}pts); stop not hit",
    )


def classify_short(
    net_now: float,
    stop_loss: float | None,
    adverse_move_pts: float,
    expected_move_pts: float,
    time_to_worthless_min: float | None,
) -> Classification:
    """
    Short premium:
      Dead    — SL hit (loss through max loss), or cushion < 0.5× expected with < 30 min left.
      At risk — adverse move to SL < expected move (a priced-in swing reaches the stop).
      Safe    — cushion to SL ≥ expected move.
    """
    low_confidence = time_to_worthless_min is None
    ttw = time_to_worthless_min if time_to_worthless_min is not None else float("inf")
    current_loss = max(-net_now, 0.0)

    if stop_loss is not None:
        # stop_loss for shorts is a negative net or a positive max-loss budget.
        sl = stop_loss if stop_loss < 0 else -abs(stop_loss)
        if net_now <= sl:
            return Classification(
                PositionState.DEAD, low_confidence,
                f"net now (₹{net_now:.0f}) is at or through stop (₹{sl:.0f})",
            )

    if ttw < LOW_TIME_MIN and adverse_move_pts < 0.5 * expected_move_pts:
        return Classification(
            PositionState.DEAD, low_confidence,
            f"cushion to stop ({adverse_move_pts:.0f}pts) < 0.5× expected with {ttw:.0f}min left",
        )

    if adverse_move_pts < expected_move_pts:
        return Classification(
            PositionState.AT_RISK, low_confidence,
            f"adverse move to stop ({adverse_move_pts:.0f}pts) < expected ({expected_move_pts:.0f}pts)",
        )

    return Classification(
        PositionState.SAFE, low_confidence,
        f"adverse move to stop ({adverse_move_pts:.0f}pts) ≥ expected ({expected_move_pts:.0f}pts)",
    )
