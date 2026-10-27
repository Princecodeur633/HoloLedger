"""Period boundaries computed from a reference date (never stored in DB)."""

import calendar
from datetime import date, timedelta

PERIODS = ("day", "week", "month", "quarter", "semester", "year")


def _month_end(year, month):
    return date(year, month, calendar.monthrange(year, month)[1])


def period_bounds(period, ref):
    """Return (start, end) inclusive for the period containing `ref`."""
    if period == "day":
        return ref, ref
    if period == "week":
        start = ref - timedelta(days=ref.weekday())  # Monday
        return start, start + timedelta(days=6)
    if period == "month":
        return ref.replace(day=1), _month_end(ref.year, ref.month)
    if period == "quarter":
        first = 3 * ((ref.month - 1) // 3) + 1
        return date(ref.year, first, 1), _month_end(ref.year, first + 2)
    if period == "semester":
        first = 1 if ref.month <= 6 else 7
        return date(ref.year, first, 1), _month_end(ref.year, first + 5)
    if period == "year":
        return date(ref.year, 1, 1), date(ref.year, 12, 31)
    raise ValueError(f"Période inconnue : {period}")


# Granularity of the evolution chart for each period.
BUCKET_FOR_PERIOD = {
    "day": "day",
    "week": "day",
    "month": "day",
    "quarter": "week",
    "semester": "month",
    "year": "month",
}
