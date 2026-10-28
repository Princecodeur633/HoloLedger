from unittest import mock

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from transactions.models import Transaction

from .models import PushSubscription

User = get_user_model()

SUBSCRIPTION = {
    "endpoint": "https://push.example.com/abc",
    "keys": {"p256dh": "key", "auth": "secret"},
}


@override_settings(VAPID_PUBLIC_KEY="pub", VAPID_PRIVATE_KEY="priv", CRON_SECRET="cron")
class ReminderTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("awa", "awa@example.com", "pw")
        self.client.force_authenticate(self.user)

    def test_status_and_subscribe_unsubscribe(self):
        self.assertEqual(self.client.get("/api/reminders/push/").data["public_key"], "pub")
        res = self.client.post("/api/reminders/push/subscribe/", SUBSCRIPTION, format="json")
        self.assertEqual(res.status_code, 201)
        # Subscribing twice from the same browser keeps one row.
        self.client.post("/api/reminders/push/subscribe/", SUBSCRIPTION, format="json")
        self.assertEqual(PushSubscription.objects.count(), 1)
        self.client.post("/api/reminders/push/unsubscribe/", {"endpoint": SUBSCRIPTION["endpoint"]})
        self.assertFalse(PushSubscription.objects.exists())

    def test_cron_requires_secret(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/reminders/cron/daily/").status_code, 403)
        res = self.client.get("/api/reminders/cron/daily/", HTTP_AUTHORIZATION="Bearer wrong")
        self.assertEqual(res.status_code, 403)

    @mock.patch("reminders.push.send", return_value=True)
    def test_cron_skips_users_who_already_logged_today(self, send):
        self.client.post("/api/reminders/push/subscribe/", SUBSCRIPTION, format="json")
        self.client.force_authenticate(None)
        call = lambda: self.client.get(  # noqa: E731
            "/api/reminders/cron/daily/", HTTP_AUTHORIZATION="Bearer cron"
        )

        self.assertEqual(call().data["sent"], 1)

        Transaction.objects.create(
            user=self.user,
            type="expense",
            amount="500",
            date=timezone.localdate(),
            category=self.user.categories.filter(type__in=["expense", "both"]).first(),
            account=self.user.accounts.first(),
        )
        self.assertEqual(call().data["sent"], 0)
