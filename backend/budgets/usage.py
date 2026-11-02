"""Budget consumption over each budget's period, shared by the budgets API and the dashboard."""

from decimal import Decimal

from django.db.models import Sum

from transactions.models import Transaction
from transactions.periods import period_bounds

OK, WARNING, OVER = "ok", "warning", "over"


def budget_usage(budgets, ref):
    """Return {budget_id: usage dict} for the period (month, quarter…) containing `ref`."""
    budgets = list(budgets)
    if not budgets:
        return {}
    spent = {}
    for period in {b.period for b in budgets}:
        start, end = period_bounds(period, ref)
        rows = (
            Transaction.objects.filter(
                space=budgets[0].space_id,
                type=Transaction.Type.EXPENSE,
                date__range=(start, end),
                category__in=[b.category_id for b in budgets if b.period == period],
            )
            .values_list("category")
            .annotate(total=Sum("amount"))
        )
        spent[period] = (start, end, dict(rows))

    usage = {}
    for budget in budgets:
        start, end, by_category = spent[budget.period]
        spent_amount = by_category.get(budget.category_id, Decimal("0"))
        percent = round(float(spent_amount / budget.amount * 100), 1)
        if spent_amount > budget.amount:
            status = OVER
        elif percent >= budget.alert_threshold:
            status = WARNING
        else:
            status = OK
        usage[budget.id] = {
            "month_start": start,
            "month_end": end,
            "spent": spent_amount,
            "remaining": budget.amount - spent_amount,
            "percent": percent,
            "status": status,
        }
    return usage
