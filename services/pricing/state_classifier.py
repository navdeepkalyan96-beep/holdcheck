"""
state_classifier.py — On plan / Hope / Fear / Dead for long premium positions,
and the seller-mode variant (Safe / At risk / Near danger / Expiring safe).

Pure function. Priority order matters — see SPEC.md section 4. These thresholds
(DEFAULT_FEAR_FRACTION etc.) are product decisions, not derived constants —
tune them, but keep them named and visible, never hardcode inline elsewhere.
"""

from dataclasses import dataclass
from enum import Enum


class BuyerState(str, Enum):
    ON_PLAN = "on_plan"
    HOPE = "hope"
    FEAR = "fear"
    DEAD = "dead"


class SellerState(str, Enum):
    SAFE = "safe"
    AT_RISK = "at_risk"
    NEAR_DANGER = "near_danger"
    EXPIRING_SAFE = "expiring_safe"


DEFAULT_FEAR_FRACTION = 0.80
DEFAULT_DEAD_MULTIPLE = 2.0
DEFAULT_LOW_TIME_MIN = 30.0
DEFAULT_PLAUSIBLE_TIME_MIN = 15.0


@dataclass(frozen=True)
class BuyerClassification:
    state: BuyerState
    low_confidence: bool
    reason: str


def classify_buyer(
    net_now: float,
    target_net: float,
    required_move_pts: float,
    expected_move_pts: float,
    time_to_worthless_min: float | None,
    fear_fraction: float = DEFAULT_FEAR_FRACTION,
    dead_multiple: float = DEFAULT_DEAD_MULTIPLE,
    low_time_min: float = DEFAULT_LOW_TIME_MIN,
    plausible_time_min: float = DEFAULT_PLAUSIBLE_TIME_MIN,
) -> BuyerClassification:
    """
    target_net must always be provided — caller substitutes the inferred
    50%-premium placeholder if the user set no Plan, and the DTO must carry a
    separate `plan_is_inferred` flag so the UI can show "no plan" honestly.

    time_to_worthless_min == None means "cannot estimate" (e.g. theta ~ 0) —
    treated as low_confidence, not as a de facto Dead or On-plan signal.
    """
    low_confidence = time_to_worthless_min is None

    # Priority 1: Fear — checked first regardless of the move relationship,
    # because a near-target winner should never get buried under Hope/Dead logic.
    if target_net > 0 and net_now >= fear_fraction * target_net:
        return BuyerClassification(
            BuyerState.FEAR, low_confidence,
            f"net now (₹{net_now:.0f}) is ≥{fear_fraction*100:.0f}% of target (₹{target_net:.0f})",
        )

    ttw = time_to_worthless_min if time_to_worthless_min is not None else float("inf")

    # Priority 2: Dead
    if required_move_pts > dead_multiple * expected_move_pts or ttw < low_time_min:
        return BuyerClassification(
            BuyerState.DEAD, low_confidence,
            f"required move ({required_move_pts:.0f}pts) > {dead_multiple:.0f}x expected "
            f"({expected_move_pts:.0f}pts), or time to worthless < {low_time_min:.0f}min",
        )

    # Priority 3: Hope
    if required_move_pts > expected_move_pts:
        return BuyerClassification(
            BuyerState.HOPE, low_confidence,
            f"required move ({required_move_pts:.0f}pts) > expected move ({expected_move_pts:.0f}pts)",
        )

    # Priority 4: On plan
    if ttw < plausible_time_min:
        return BuyerClassification(
            BuyerState.DEAD, low_confidence,
            f"required move is within expected move but only {ttw:.0f}min of plausible time left",
        )

    return BuyerClassification(
        BuyerState.ON_PLAN, low_confidence,
        f"required move ({required_move_pts:.0f}pts) ≤ expected move ({expected_move_pts:.0f}pts)",
    )


@dataclass(frozen=True)
class SellerClassification:
    state: SellerState
    low_confidence: bool
    reason: str


def classify_seller(
    current_loss: float,          # positive number = loss so far, 0 if profitable
    max_loss: float,
    adverse_move_pts: float,      # points against the short until danger (max loss / strike)
    expected_move_pts: float,
    time_to_worthless_min: float | None,
    fear_fraction: float = DEFAULT_FEAR_FRACTION,
    low_time_min: float = DEFAULT_LOW_TIME_MIN,
) -> SellerClassification:
    """
    NOTE: seller-side 4-state mapping is a proposed default per SPEC.md §4,
    not fully locked by the product spec — confirm labels/thresholds before
    shipping. Kept as its own function (not reusing BuyerState) so the two
    can diverge without contorting one enum.
    """
    low_confidence = time_to_worthless_min is None
    ttw = time_to_worthless_min if time_to_worthless_min is not None else float("inf")

    if max_loss > 0 and current_loss >= fear_fraction * max_loss:
        return SellerClassification(
            SellerState.NEAR_DANGER, low_confidence,
            f"current loss (₹{current_loss:.0f}) is ≥{fear_fraction*100:.0f}% of max loss (₹{max_loss:.0f})",
        )

    if ttw < low_time_min and adverse_move_pts >= expected_move_pts:
        return SellerClassification(
            SellerState.EXPIRING_SAFE, low_confidence,
            f"theta captured, {adverse_move_pts:.0f}pts of cushion vs {ttw:.0f}min left",
        )

    if adverse_move_pts >= expected_move_pts:
        return SellerClassification(
            SellerState.SAFE, low_confidence,
            f"adverse move to danger ({adverse_move_pts:.0f}pts) ≥ expected move ({expected_move_pts:.0f}pts)",
        )

    return SellerClassification(
        SellerState.AT_RISK, low_confidence,
        f"adverse move to danger ({adverse_move_pts:.0f}pts) < expected move ({expected_move_pts:.0f}pts)",
    )
