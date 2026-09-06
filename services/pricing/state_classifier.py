"""Three-state classifier: Safe / At risk / Dead."""

from dataclasses import dataclass
from enum import Enum


class PositionState(str, Enum):
    SAFE = "safe"
    AT_RISK = "at_risk"
    DEAD = "dead"

DEAD_MOVE_MULTIPLE = 2.0
AT_RISK_MOVE_MULTIPLE = 1.0
LOW_TIME_MIN = 30.0


@dataclass(frozen=True)
class Classification:
    state: PositionState
    low_confidence: bool
    reason: str


def _loss_floor(stop_loss: float | None) -> float | None:
    """User types Stop as rupees they can lose (500). Floor is -500."""
    if stop_loss is None:
        return None
    return -abs(float(stop_loss))


def classify_long(
    net_now: float,
    stop_loss: float | None,
    required_move_pts: float,
    expected_move_pts: float,
    time_to_worthless_min: float | None,
) -> Classification:
    low_confidence = time_to_worthless_min is None
    ttw = time_to_worthless_min if time_to_worthless_min is not None else float("inf")
    sl = _loss_floor(stop_loss)

    if sl is not None and net_now <= sl:
        return Classification(
            PositionState.DEAD, low_confidence,
            f"net now (₹{net_now:.0f}) is through stop (₹{sl:.0f})",
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
    low_confidence = time_to_worthless_min is None
    ttw = time_to_worthless_min if time_to_worthless_min is not None else float("inf")
    sl = _loss_floor(stop_loss)

    if sl is not None and net_now <= sl:
        return Classification(
            PositionState.DEAD, low_confidence,
            f"net now (₹{net_now:.0f}) is through stop (₹{sl:.0f})",
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
