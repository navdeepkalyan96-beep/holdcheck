"""Classifier from OI, IV change, delta, gamma, theta. No expected-move."""

from dataclasses import dataclass
from enum import Enum


class PositionState(str, Enum):
    SAFE = "safe"
    AT_RISK = "at_risk"
    DEAD = "dead"


@dataclass(frozen=True)
class Classification:
    state: PositionState
    low_confidence: bool
    reason: str
    analysis: str


def classify_greeks(
    *,
    is_long: bool,
    days_to_expiry: float,
    iv: float | None,
    iv_change: float | None,
    delta: float | None,
    gamma: float | None,
    theta_per_hour: float | None,
    oi_bias: str,
    net_now: float,
    stop_floor: float | None,
) -> Classification:
    hits: list[str] = []
    score = 0

    if stop_floor is not None and net_now <= stop_floor:
        return Classification(
            PositionState.DEAD, False,
            f"net ₹{net_now:.0f} through stop ₹{stop_floor:.0f}",
            "Book is through the rupee stop. Exit logic is yours; the tag is Dead.",
        )

    dte = days_to_expiry
    dlt = abs(delta or 0)
    th = abs(theta_per_hour or 0)
    ivc = iv_change if iv_change is not None else 0.0
    against = (is_long and oi_bias == "bearish") or ((not is_long) and oi_bias == "bullish")

    if dte <= 1.5:
        score += 2
        hits.append(f"expiry in {dte:.1f}d")
    elif dte <= 3:
        score += 1
        hits.append(f"near expiry ({dte:.1f}d)")

    if dlt < 8:
        score += 2
        hits.append(f"low delta ({dlt:.1f})")
    elif dlt < 20:
        score += 1
        hits.append(f"modest delta ({dlt:.1f})")

    if th >= 400:
        score += 2
        hits.append(f"theta {th:.0f}/h")
    elif th >= 150:
        score += 1
        hits.append(f"theta {th:.0f}/h")

    if ivc <= -0.02:
        score += 2
        hits.append(f"IV crashing ({ivc*100:.1f} pts)")
    elif ivc < -0.005:
        score += 1
        hits.append(f"IV down ({ivc*100:.1f} pts)")

    if against:
        score += 1
        hits.append(f"OI {oi_bias} vs position")

    if score >= 5:
        state = PositionState.DEAD
        tag = "Unlikely to reach target on this path: " + ", ".join(hits) + "."
    elif score >= 2:
        state = PositionState.AT_RISK
        tag = "Pressure on the plan: " + ", ".join(hits) + "."
    else:
        state = PositionState.SAFE
        tag = "Greeks and OI are not fighting the plan" + ((": " + ", ".join(hits)) if hits else ".")

    analysis = (
        f"{'Long' if is_long else 'Short'}. {dte:.1f} days left. "
        f"IV {(iv or 0)*100:.1f}% (chg {ivc*100:+.1f} pts). "
        f"Delta {delta or 0:.1f}, gamma {gamma or 0:.4f}, theta {theta_per_hour or 0:.0f}/h. "
        f"OI {oi_bias}. "
        + tag
    )
    return Classification(state, iv is None, tag, analysis)
