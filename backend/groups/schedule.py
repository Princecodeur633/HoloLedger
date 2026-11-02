"""Who owes what, period by period.

Payments are not tied to a period: they fill a member's periods in order. So an advance
(paying three months at once) simply covers the next periods, and a late payment closes the
oldest gap first.
"""

import calendar
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from .models import Contribution, GroupRules

ZERO = Decimal("0")
PAID, PENDING, DUE, LATE, UPCOMING = "paid", "pending", "due", "late", "upcoming"
SHOWN_FAMILY_PERIODS = 6


def next_date(rules, current):
    if rules.frequency == GroupRules.Frequency.WEEKLY:
        return current + timedelta(weeks=1)
    if rules.frequency == GroupRules.Frequency.BIWEEKLY:
        return current + timedelta(weeks=2)
    index = current.year * 12 + current.month  # next month
    year, month = divmod(index, 12)
    month += 1
    day = min(rules.start_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def due_dates(rules, count):
    dates, current = [], rules.start_date
    for _ in range(count):
        dates.append(current)
        current = next_date(rules, current)
    return dates


def member_amount(member, rules):
    return member.expected_amount if member.expected_amount is not None else rules.contribution_amount


def build_board(space, today=None):
    """Everything the group screens show: periods, each member's status, totals."""
    today = today or timezone.localdate()
    rules, _ = GroupRules.objects.get_or_create(space=space)
    members = list(space.group_members.filter(is_active=True))
    is_tontine = space.kind == space.Kind.TONTINE

    sums = {}
    for row in (
        Contribution.objects.filter(space=space)
        .exclude(status=Contribution.Status.REFUSED)
        .values("member", "status")
        .annotate(total=Sum("amount"))
    ):
        sums[(row["member"], row["status"])] = row["total"]

    if is_tontine:
        # One full round: every member receives the pot once.
        dates = due_dates(rules, max(len(members), 1))
    else:
        dates, current = [], rules.start_date
        while current <= today:
            dates.append(current)
            current = next_date(rules, current)
        dates.append(current)  # the next period, so upcoming payments show
    delay = timedelta(days=rules.payment_delay_days)
    elapsed = sum(1 for d in dates if d <= today)

    member_rows = []
    covered = [ZERO] * len(dates)  # tontine: money collected for each session
    for member in members:
        amount = member_amount(member, rules)
        paid = sums.get((member.id, Contribution.Status.VALIDATED), ZERO)
        pending = sums.get((member.id, Contribution.Status.PENDING), ZERO)
        statuses = []
        for i, due in enumerate(dates):
            needed = amount * (i + 1)
            if paid >= needed:
                status = PAID
            elif paid + pending >= needed:
                status = PENDING
            elif due > today:
                status = UPCOMING
            elif today > due + delay:
                status = LATE
            else:
                status = DUE
            statuses.append(status)
            covered[i] += min(max(paid - amount * i, ZERO), amount)
        late = statuses.count(LATE)
        owed = amount * elapsed
        member_rows.append(
            {
                "id": str(member.id),
                "name": member.name,
                "phone": member.phone,
                "user": str(member.user_id) if member.user_id else None,
                "position": member.position,
                "amount": amount,
                "expected_amount": member.expected_amount,
                "paid": paid,
                "pending": pending,
                "owed_to_date": owed,
                "arrears": max(owed - paid, ZERO),
                "advance": max(paid - owed, ZERO),
                "late_count": late,
                "penalty": rules.late_penalty * late,
                "statuses": statuses,
            }
        )

    payouts = {p.session: p for p in space.payouts.select_related("member")}
    periods = []
    for i, due in enumerate(dates):
        period = {
            "index": i + 1,
            "date": due,
            "deadline": due + delay,
            "collected": covered[i],
            "expected": sum((member_amount(m, rules) for m in members), ZERO),
        }
        if is_tontine:
            beneficiary = members[i] if i < len(members) else None
            payout = payouts.get(i + 1)
            period["beneficiary"] = (
                {"id": str(beneficiary.id), "name": beneficiary.name} if beneficiary else None
            )
            period["payout"] = (
                {
                    "id": str(payout.id),
                    "amount": payout.amount,
                    "date": payout.date,
                    "member": payout.member.name,
                    "recorded_in_personal": payout.recorded_in_personal,
                    "member_user": str(payout.member.user_id) if payout.member.user_id else None,
                }
                if payout
                else None
            )
        periods.append(period)

    validated = sum((r["paid"] for r in member_rows), ZERO)
    pending_total = sum((r["pending"] for r in member_rows), ZERO)
    spent = space.group_expenses.aggregate(total=Sum("amount"))["total"] or ZERO
    paid_out = sum((p.amount for p in payouts.values()), ZERO)
    current = next(
        (p for p in periods if is_tontine and p["payout"] is None),
        periods[elapsed - 1] if elapsed else (periods[0] if periods else None),
    )

    if not is_tontine and len(periods) > SHOWN_FAMILY_PERIODS:
        # The family table shows the latest periods; statuses before them are still counted.
        cut = len(periods) - SHOWN_FAMILY_PERIODS
        periods = periods[cut:]
        for row in member_rows:
            row["statuses"] = row["statuses"][cut:]

    return {
        "rules": rules,
        "members": member_rows,
        "periods": periods,
        "current_period": current,
        "totals": {
            "validated": validated,
            "pending": pending_total,
            "spent": spent,
            "paid_out": paid_out,
            "cash": validated - spent - paid_out,
            "arrears": sum((r["arrears"] for r in member_rows), ZERO),
            "penalties": sum((r["penalty"] for r in member_rows), ZERO),
            "late_members": sum(1 for r in member_rows if r["late_count"]),
        },
    }
