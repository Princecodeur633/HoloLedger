"""Statistics endpoints: summary, per-period figures and category breakdown."""

from collections import OrderedDict
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from spaces.services import request_space

from .models import Transaction
from .periods import BUCKET_FOR_PERIOD, PERIODS, period_bounds
from .serializers import TransactionSerializer

ZERO = Value(Decimal("0"), output_field=DecimalField(max_digits=14, decimal_places=2))
INCOME = Transaction.Type.INCOME
EXPENSE = Transaction.Type.EXPENSE


ZERO_DECIMAL = Decimal("0")


def totals(queryset):
    agg = queryset.aggregate(
        income=Coalesce(Sum("amount", filter=Q(type=INCOME)), ZERO),
        expense=Coalesce(Sum("amount", filter=Q(type=EXPENSE)), ZERO),
        count=Count("id"),
    )
    agg["net"] = agg["income"] - agg["expense"]
    return agg


def parse_ref_date(request):
    raw = request.query_params.get("date")
    if not raw:
        return timezone.localdate()
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise ValidationError({"date": "Format attendu : AAAA-MM-JJ."})


def parse_period(request, default="month"):
    period = request.query_params.get("period", default)
    if period not in PERIODS:
        raise ValidationError({"period": f"Valeurs possibles : {', '.join(PERIODS)}."})
    return period


def bucket_start(day, bucket):
    if bucket == "week":
        return day - timedelta(days=day.weekday())
    if bucket == "month":
        return day.replace(day=1)
    return day


def next_bucket(start, bucket):
    if bucket == "day":
        return start + timedelta(days=1)
    if bucket == "week":
        return start + timedelta(days=7)
    return (start.replace(day=28) + timedelta(days=4)).replace(day=1)


def evolution(queryset, start, end, bucket):
    """Income/expense per bucket over [start, end], with empty buckets filled."""
    series = OrderedDict()
    cursor = bucket_start(start, bucket)
    while cursor <= end:
        series[cursor] = {"income": Decimal("0"), "expense": Decimal("0")}
        cursor = next_bucket(cursor, bucket)

    rows = queryset.values("date", "type").annotate(total=Sum("amount"))
    for row in rows:
        series[bucket_start(row["date"], bucket)][row["type"]] += row["total"]

    return [
        {"start": key, "income": v["income"], "expense": v["expense"], "net": v["income"] - v["expense"]}
        for key, v in series.items()
    ]


def category_breakdown(queryset, type_):
    rows = (
        queryset.filter(type=type_)
        .values("category__id", "category__name", "category__color", "category__icon")
        .annotate(total=Sum("amount"), count=Count("id"))
        .order_by("-total")
    )
    grand_total = sum((r["total"] for r in rows), Decimal("0"))
    return [
        {
            "category": {
                "id": r["category__id"],
                "name": r["category__name"],
                "color": r["category__color"],
                "icon": r["category__icon"],
            },
            "total": r["total"],
            "count": r["count"],
            "percent": round(float(r["total"] / grand_total * 100), 1) if grand_total else 0,
        }
        for r in rows
    ]


class SummaryView(APIView):
    """Everything the dashboard needs: balances, month figures, alerts and recent activity."""

    def get(self, request):
        from accounts.balances import account_balances
        from budgets.models import Budget
        from budgets.usage import OK, budget_usage
        from debts.views import open_totals
        from recurring.services import pending_occurrences, process_due_rules

        space = request_space(request)
        process_due_rules(space=space)
        qs = Transaction.objects.filter(space=space)
        today = timezone.localdate()
        month_start, month_end = period_bounds("month", today)
        month_qs = qs.filter(date__range=(month_start, month_end))
        overall = totals(qs)
        recent = qs.select_related("category", "account")[:5]

        balances = account_balances(space)
        accounts = [
            {
                "id": a.id,
                "name": a.name,
                "type": a.type,
                "color": a.color,
                "icon": a.icon,
                "balance": balances.get(a.id, a.initial_balance),
            }
            for a in space.accounts.filter(is_archived=False)
        ]

        budgets = Budget.objects.filter(space=space).select_related("category")
        usage = budget_usage(budgets, today)
        alerts = [
            {
                "budget": b.id,
                "category": {
                    "id": b.category.id,
                    "name": b.category.name,
                    "color": b.category.color,
                    "icon": b.category.icon,
                },
                "amount": b.amount,
                **usage[b.id],
            }
            for b in budgets
            if usage[b.id]["status"] != OK
        ]
        alerts.sort(key=lambda a: -a["percent"])

        # Last month's recap, compared with the month before.
        last_start, last_end = period_bounds("month", month_start - timedelta(days=1))
        before_start, before_end = period_bounds("month", last_start - timedelta(days=1))
        last_qs = qs.filter(date__range=(last_start, last_end))
        last_totals = totals(last_qs)
        last_top = category_breakdown(last_qs, EXPENSE)[:1]
        last_month = {
            "start": last_start,
            **last_totals,
            "previous_expense": totals(qs.filter(date__range=(before_start, before_end)))[
                "expense"
            ],
            "top_category": last_top[0] if last_top else None,
        }

        # Daily total balance over the last 30 days, for the sparkline on the balance card.
        trend = balance_history(space, today - timedelta(days=29), today, "day")

        # Shared spaces: who put in / spent how much this month ("payé par").
        members = []
        if space.kind != space.Kind.PERSONAL:
            by_user = {
                (row["user"], row["type"]): row["total"]
                for row in month_qs.values("user", "type").annotate(total=Sum("amount"))
            }
            for membership in space.memberships.select_related("user"):
                member = membership.user
                members.append(
                    {
                        "id": member.id,
                        "username": member.username,
                        "income": by_user.get((member.id, INCOME), ZERO_DECIMAL),
                        "expense": by_user.get((member.id, EXPENSE), ZERO_DECIMAL),
                    }
                )

        return Response(
            {
                "currency": space.currency,
                "space": {"id": space.id, "kind": space.kind, "name": space.name},
                "members": members,
                "balance": sum(balances.values(), Decimal("0")),
                "total_income": overall["income"],
                "total_expense": overall["expense"],
                "accounts": accounts,
                "month": {"start": month_start, "end": month_end, **totals(month_qs)},
                "top_expense_categories": category_breakdown(month_qs, EXPENSE)[:5],
                "budget_alerts": alerts,
                "pending_recurring_count": pending_occurrences(space).count(),
                "balance_trend": [point["balance"] for point in trend],
                "last_month": last_month,
                "debts": open_totals(space),
                "recent_transactions": TransactionSerializer(
                    recent, many=True, context={"request": request}
                ).data,
            }
        )


class PeriodStatsView(APIView):
    """GET /api/stats/period/?period=month&date=2026-10-26"""

    def get(self, request):
        period = parse_period(request)
        start, end = period_bounds(period, parse_ref_date(request))
        space = request_space(request)
        qs = Transaction.objects.filter(space=space, date__range=(start, end))
        bucket = BUCKET_FOR_PERIOD[period]

        return Response(
            {
                "period": period,
                "start": start,
                "end": end,
                "currency": space.currency,
                **totals(qs),
                "bucket": bucket,
                "series": evolution(qs, start, end, bucket),
            }
        )


class CategoryStatsView(APIView):
    """GET /api/stats/categories/?period=month&date=...&type=expense"""

    def get(self, request):
        period = parse_period(request)
        start, end = period_bounds(period, parse_ref_date(request))
        type_ = request.query_params.get("type", EXPENSE)
        if type_ not in Transaction.Type.values:
            raise ValidationError({"type": "Valeurs possibles : income, expense."})
        qs = Transaction.objects.filter(space=request_space(request), date__range=(start, end))

        return Response(
            {
                "period": period,
                "start": start,
                "end": end,
                "type": type_,
                "categories": category_breakdown(qs, type_),
            }
        )


def percent_change(current, previous):
    if not previous:
        return None
    return round(float((current - previous) / previous * 100), 1)


def balance_history(space, start, end, bucket):
    """Total balance of the space at the end of each bucket.

    Transfers inside the space cancel out; transfers to / from another space move money in
    or out of it and are counted.
    """
    from accounts.models import Account, Transfer

    initial = Account.objects.filter(space=space).aggregate(
        total=Coalesce(Sum("initial_balance"), ZERO)
    )
    qs = Transaction.objects.filter(space=space)
    moves = []  # (date, signed amount) of transfers crossing the space boundary
    crossing = Transfer.objects.filter(
        Q(from_account__space=space) ^ Q(to_account__space=space)
    ).values_list("date", "amount", "to_account__space")
    for date_, amount, to_space in crossing:
        moves.append((date_, amount if to_space == space.id else -amount))

    running = initial["total"] + totals(qs.filter(date__lt=start))["net"]
    running += sum((a for d, a in moves if d < start), Decimal("0"))
    points = evolution(qs.filter(date__range=(start, end)), start, end, bucket)
    history = []
    for i, point in enumerate(points):
        bucket_end = points[i + 1]["start"] - timedelta(days=1) if i + 1 < len(points) else end
        running += point["net"]
        running += sum((a for d, a in moves if point["start"] <= d <= bucket_end), Decimal("0"))
        history.append({"start": point["start"], "balance": running})
    return history


class InsightsView(APIView):
    """GET /api/stats/insights/?period=month&date=… — advanced statistics for a period."""

    def get(self, request):
        space = request_space(request)
        period = parse_period(request)
        start, end = period_bounds(period, parse_ref_date(request))
        prev_start, prev_end = period_bounds(period, start - timedelta(days=1))
        qs = Transaction.objects.filter(space=space)
        current = totals(qs.filter(date__range=(start, end)))
        previous = totals(qs.filter(date__range=(prev_start, prev_end)))

        today = timezone.localdate()
        total_days = (end - start).days + 1
        if today < start:
            elapsed = 0
        elif today > end:
            elapsed = total_days
        else:
            elapsed = (today - start).days + 1

        projection = None
        if 0 < elapsed < total_days:
            projected_expense = current["expense"] / elapsed * total_days
            projection = {
                "expense": projected_expense.quantize(Decimal("1")),
                "net": (current["income"] - projected_expense).quantize(Decimal("1")),
            }

        period_qs = qs.filter(date__range=(start, end))
        expenses = period_qs.filter(type=EXPENSE)
        by_payment = [
            {"payment_method": row["payment_method"], "total": row["total"]}
            for row in expenses.values("payment_method")
            .annotate(total=Sum("amount"))
            .order_by("-total")
        ]
        by_account = [
            {
                "account": row["account__id"],
                "name": row["account__name"],
                "color": row["account__color"],
                **totals(period_qs.filter(account=row["account__id"])),
            }
            for row in period_qs.values("account__id", "account__name", "account__color").distinct()
        ]
        top = expenses.select_related("category", "account").order_by("-amount", "-date")[:5]

        bucket = BUCKET_FOR_PERIOD[period]
        if period in ("day", "week"):
            # A day or week has too few points for a meaningful balance curve: show the month.
            hist_start, hist_end, bucket = *period_bounds("month", start), "day"
        else:
            hist_start, hist_end = start, end

        return Response(
            {
                "period": period,
                "start": start,
                "end": end,
                "currency": space.currency,
                "current": current,
                "previous": {"start": prev_start, "end": prev_end, **previous},
                "change": {
                    "income": percent_change(current["income"], previous["income"]),
                    "expense": percent_change(current["expense"], previous["expense"]),
                },
                "savings_rate": round(float(current["net"] / current["income"] * 100), 1)
                if current["income"]
                else None,
                "days_elapsed": elapsed,
                "days_total": total_days,
                "average_daily_expense": (current["expense"] / elapsed).quantize(Decimal("1"))
                if elapsed
                else None,
                "projection": projection,
                "top_expenses": TransactionSerializer(
                    top, many=True, context={"request": request}
                ).data,
                "by_payment_method": by_payment,
                "by_account": by_account,
                "balance_history": balance_history(space, hist_start, hist_end, bucket),
                "balance_history_bucket": bucket,
            }
        )
