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


def send_daily_reminders(today=None):
    """Remind every subscribed user who has not recorded any operation today."""
    today = today or timezone.localdate()
    active_today = Transaction.objects.filter(date=today).values("user_id")
    subscriptions = PushSubscription.objects.exclude(user_id__in=active_today).select_related(
        "user"
    )
    return sum(send(sub, REMINDER) for sub in subscriptions)
