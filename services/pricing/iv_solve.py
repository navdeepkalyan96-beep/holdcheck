"""Implied vol from traded premium via Black-76."""

from black76 import OptionType, price


def implied_vol(F: float, K: float, T: float, r: float, opt_type: OptionType, mkt: float) -> float | None:
    if T <= 0 or F <= 0 or K <= 0 or mkt is None or mkt <= 0:
        return None
    lo, hi = 0.02, 3.0
    for _ in range(40):
        mid = (lo + hi) / 2
        px = price(F, K, mid, T, r, opt_type)
        if px > mkt:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2
