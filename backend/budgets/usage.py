"""Budget consumption for a given month, shared by the budgets API and the dashboard."""

from decimal import Decimal

from django.db.models import Sum

from transactions.models import Transaction
from transactions.periods import period_bounds

OK, WARNING, OVER = "ok", "warning", "over"


def budget_usage(budgets, ref):
    """Return {budget_id: usage dict} for the month containing `ref`."""
    budgets = list(budgets)
    if not budgets:
        return {}
    start, end = period_bounds("month", ref)
    spent_by_category = dict(
        Transaction.objects.filter(
            user=budgets[0].user_id,
            type=Transaction.Type.EXPENSE,
            date__range=(start, end),
            category__in=[b.category_id for b in budgets],
        )
        .values_list("category")
        .annotate(total=Sum("amount"))
    )

    usage = {}
    for budget in budgets:
        spent = spent_by_category.get(budget.category_id, Decimal("0"))
        percent = round(float(spent / budget.amount * 100), 1)
        if spent > budget.amount:
            status = OVER
        elif percent >= budget.alert_threshold:
            status = WARNING
        else:
            status = OK
        usage[budget.id] = {
            "month_start": start,
            "month_end": end,
            "spent": spent,
            "remaining": budget.amount - spent,
            "percent": percent,
            "status": status,
        }
    return usage
