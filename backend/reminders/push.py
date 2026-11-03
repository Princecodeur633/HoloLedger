"""Web Push (free, standard browser feature) for the daily "did you log your expenses?" reminder."""

import json
import logging

from django.conf import settings
from django.utils import timezone

from transactions.models import Transaction

from .models import PushSubscription

logger = logging.getLogger(__name__)

REMINDER = {
    "title": "HoloLedger",
    "body": "As-tu noté tes dépenses aujourd’hui ?",
    "url": "/transactions/new",
}


def is_enabled() -> bool:
    return bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY)


def send(subscription: PushSubscription, payload: dict) -> bool:
    """Send one notification. A subscription the browser revoked (404/410) is deleted."""
    from pywebpush import WebPushException, webpush  # heavy import, only when sending

    try:
        webpush(
            subscription_info=subscription.as_subscription_info(),
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_CONTACT},
            ttl=12 * 3600,
            timeout=10,
        )
        return True
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None)
        if status in (404, 410):
            subscription.delete()
        else:
            logger.warning("Push to %s failed: %s", subscription.user, exc)
        return False


def group_lines(user, today, boards):
    """Contribution reminders for one person: dues, delays, and payments to validate."""
    from groups.models import Contribution
    from spaces.models import Membership

    lines, url = [], None
    memberships = Membership.objects.filter(
        user=user, space__kind__in=["tontine", "family"]
    ).select_related("space")
    for membership in memberships:
        space = membership.space
        if space.id not in boards:
            from groups.schedule import build_board

            boards[space.id] = build_board(space, today)
        board = boards[space.id]
        period = board["current_period"]
        row = next((r for r in board["members"] if r["user"] == str(user.id)), None)
        if period and row:
            index = next(
                (i for i, p in enumerate(board["periods"]) if p["index"] == period["index"]), None
            )
            status = row["statuses"][index] if index is not None else None
            if status == "late" or row["late_count"]:
                lines.append(f"Ta cotisation « {space.name} » est en retard.")
                url = "/group/pay"
            elif status == "due" and (period["deadline"] - today).days <= 1:
                when = "aujourd’hui" if period["deadline"] <= today else "demain"
                lines.append(f"Ta cotisation « {space.name} » est due {when}.")
                url = "/group/pay"
        if membership.is_manager:
            pending = space.contributions.filter(status=Contribution.Status.PENDING).count()
            if pending:
                lines.append(
                    f"{pending} versement{'s' if pending > 1 else ''} à valider dans « {space.name} »."
                )
                url = url or "/group/payments"
    return lines, url


def send_daily_reminders(today=None):
    """One notification per subscribed person, at most once a day.

    It gathers their contribution dues / delays, the payments they must validate as a
    manager, and — if nothing was recorded today — the usual "did you log your expenses?".
    """
    today = today or timezone.localdate()
    active_today = set(Transaction.objects.filter(date=today).values_list("user_id", flat=True))
    boards = {}  # each group's board is computed once, even with many members
    sent = 0
    for subscription in PushSubscription.objects.select_related("user"):
        user = subscription.user
        lines, url = group_lines(user, today, boards)
        if user.id not in active_today:
            lines.append(REMINDER["body"])
            url = url or REMINDER["url"]
        if not lines:
            continue
        body = "\n".join(lines[:4])
        sent += send(subscription, {"title": "HoloLedger", "body": body, "url": url})
    return sent
