import io
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from transactions.models import Transaction

from .models import RecurringRule

User = get_user_model()


class ScheduleTests(TestCase):
    def rule(self, **kwargs):
        # occurrence_after() only needs the schedule fields: no database row required.
        return RecurringRule(**kwargs)

    def test_monthly_keeps_day_and_clamps_month_end(self):
        rule = self.rule(frequency="monthly", interval=1, start_date=date(2026, 1, 31))
        self.assertEqual(rule.occurrence_after(date(2026, 1, 31)), date(2026, 2, 28))
        self.assertEqual(rule.occurrence_after(date(2026, 2, 28)), date(2026, 3, 31))
        self.assertEqual(rule.occurrence_after(date(2026, 12, 31)), date(2027, 1, 31))

    def test_weekly_and_yearly(self):
        rule = self.rule(frequency="weekly", interval=2, start_date=date(2026, 10, 5))
        self.assertEqual(rule.occurrence_after(date(2026, 10, 5)), date(2026, 10, 19))
        rule = self.rule(frequency="yearly", interval=1, start_date=date(2024, 2, 29))
        self.assertEqual(rule.occurrence_after(date(2024, 2, 29)), date(2025, 2, 28))


class RecurringApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("awa", "awa@example.com", "pw")
        self.client.force_authenticate(self.user)
        self.rent = self.user.categories.get(name="Loyer")
        self.salary = self.user.categories.get(name="Salaire")
        self.today = timezone.localdate()

    def create(self, **extra):
        data = {
            "type": "expense",
            "amount": "150000",
            "category": str(self.rent.id),
            "description": "Loyer",
            "frequency": "monthly",
            "start_date": str(self.today - timedelta(days=40)),
        }
        data.update(extra)
        res = self.client.post("/api/recurring/", data)
        self.assertEqual(res.status_code, 201, res.data)
        return res.data

    def test_manual_rule_waits_for_confirmation(self):
        rule = self.create()
        pending = self.client.get("/api/recurring/pending/").data
        self.assertEqual([r["id"] for r in pending["pending"]], [rule["id"]])
        self.assertFalse(Transaction.objects.exists())

        res = self.client.post(f"/api/recurring/{rule['id']}/confirm/", {"amount": "155000"})
        self.assertEqual(res.status_code, 201)
        tx = Transaction.objects.get()
        self.assertEqual((tx.amount, str(tx.recurring_rule_id)), (Decimal("155000"), rule["id"]))

        # One month later is still due (start was 40 days ago): skip it.
        self.client.post(f"/api/recurring/{rule['id']}/skip/")
        self.assertEqual(self.client.get("/api/recurring/pending/").data["pending"], [])
        self.assertEqual(Transaction.objects.count(), 1)

    def test_auto_rule_catches_up(self):
        self.create(
            type="income",
            category=str(self.salary.id),
            amount="450000",
            auto_confirm=True,
            start_date=str(self.today - timedelta(days=70)),
        )
        self.client.get("/api/stats/summary/")  # any dashboard visit processes due rules
        self.assertGreaterEqual(Transaction.objects.filter(type="income").count(), 2)
        rule = RecurringRule.objects.get()
        self.assertGreater(rule.next_date, self.today)

    def test_end_date_finishes_rule(self):
        rule = self.create(
            auto_confirm=True,
            start_date=str(self.today - timedelta(days=5)),
            end_date=str(self.today),
        )
        call_command("process_recurring", stdout=io.StringIO())
        self.assertEqual(Transaction.objects.count(), 1)
        self.assertIsNone(RecurringRule.objects.get(pk=rule["id"]).next_date)
        res = self.client.post(f"/api/recurring/{rule['id']}/confirm/")
        self.assertEqual(res.status_code, 400)

    def test_schedule_change_does_not_duplicate(self):
        rule = self.create(auto_confirm=True, start_date=str(self.today))
        self.client.get("/api/recurring/pending/")
        self.assertEqual(Transaction.objects.count(), 1)
        self.client.patch(f"/api/recurring/{rule['id']}/", {"interval": 2})
        self.client.get("/api/recurring/pending/")
        self.assertEqual(Transaction.objects.count(), 1)

    def test_category_type_checked(self):
        res = self.client.post(
            "/api/recurring/",
            {
                "type": "income",
                "amount": "1",
                "category": str(self.rent.id),
                "start_date": str(self.today),
            },
        )
        self.assertEqual(res.status_code, 400)
