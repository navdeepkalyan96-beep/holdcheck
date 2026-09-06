"""
Open-interest bias around the entry strike.

Input: ladder of strikes (typically entry ±5 = 11 rows; 10 neighbours + entry).
Each row: strike, CE OI at entry, CE OI now, PE OI at entry, PE OI now.

Rule (documented retail heuristic, not a prediction):
  dCE = sum(CE_now - CE_entry) across the window
  dPE = sum(PE_now - PE_entry)
  net = dPE - dCE
  scale = abs(dCE) + abs(dPE)
  if scale == 0 -> neutral / unavailable
  if net > 0.15 * scale -> bullish   (put OI built more than call OI: support)
  if net < -0.15 * scale -> bearish  (call OI built more than put OI: resistance)
  else -> neutral
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class OiRow:
    strike: float
    ce_entry: float
    ce_now: float
    pe_entry: float
    pe_now: float


@dataclass(frozen=True)
class OiBias:
    bias: str  # bullish | bearish | neutral | unavailable
    d_ce: float
    d_pe: float
    window_strikes: int
    reason: str


def parse_oi_ladder(raw: str | None) -> list[OiRow]:
    """Format: strike:ce_entry,ce_now,pe_entry,pe_now|strike:..."""
    if not raw or not raw.strip():
        return []
    rows: list[OiRow] = []
    for part in raw.strip().split("|"):
        part = part.strip()
        if not part:
            continue
        strike_s, rest = part.split(":", 1)
        ce_e, ce_n, pe_e, pe_n = [float(x) for x in rest.split(",")]
        rows.append(OiRow(float(strike_s), ce_e, ce_n, pe_e, pe_n))
    return rows


def classify_oi(rows: list[OiRow]) -> OiBias:
    if not rows:
        return OiBias("unavailable", 0.0, 0.0, 0, "no OI ladder supplied")

    d_ce = sum(r.ce_now - r.ce_entry for r in rows)
    d_pe = sum(r.pe_now - r.pe_entry for r in rows)
    scale = abs(d_ce) + abs(d_pe)
    if scale <= 0:
        return OiBias("neutral", d_ce, d_pe, len(rows), "OI unchanged across the window")

    net = d_pe - d_ce
    if net > 0.15 * scale:
        return OiBias(
            "bullish", d_ce, d_pe, len(rows),
            f"PE OI Δ {d_pe:.0f} vs CE OI Δ {d_ce:.0f} across {len(rows)} strikes (± window)",
        )
    if net < -0.15 * scale:
        return OiBias(
            "bearish", d_ce, d_pe, len(rows),
            f"CE OI Δ {d_ce:.0f} vs PE OI Δ {d_pe:.0f} across {len(rows)} strikes (± window)",
        )
    return OiBias(
        "neutral", d_ce, d_pe, len(rows),
        f"CE OI Δ {d_ce:.0f} and PE OI Δ {d_pe:.0f} are balanced",
    )
