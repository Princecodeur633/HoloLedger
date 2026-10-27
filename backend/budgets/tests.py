from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from transactions.models import Transaction

User = get_user_model()


class BudgetTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("awa", "awa@example.com", "pw")
        self.client.force_authenticate(self.user)
        self.food = self.user.categories.get(name="Alimentation")
        self.transport = self.user.categories.get(name="Transport")

    def spend(self, amount, category, day):
        Transaction.objects.create(
            user=self.user, type="expense", amount=amount, category=category, date=day
        )

    def test_usage_and_status(self):
        for cat in (self.food, self.transport):
            self.client.post("/api/budgets/", {"category": str(cat.id), "amount": "100000"})
        self.spend(85000, self.food, date(2026, 10, 3))
        self.spend(120000, self.transport, date(2026, 10, 4))
        self.spend(99000, self.food, date(2026, 9, 30))  # previous month: ignored

        res = self.client.get("/api/budgets/?date=2026-10-15")
        usage = {b["category_detail"]["name"]: b["usage"] for b in res.data}
        self.assertEqual(usage["Alimentation"]["status"], "warning")
        self.assertEqual(usage["Alimentation"]["spent"], Decimal("85000"))
        self.assertEqual(usage["Transport"]["status"], "over")
        self.assertEqual(usage["Transport"]["remaining"], Decimal("-20000"))

    def test_alerts_in_summary(self):
        self.client.post("/api/budgets/", {"category": str(self.food.id), "amount": "1000"})
        self.spend(1500, self.food, timezone.localdate())
        alerts = self.client.get("/api/stats/summary/").data["budget_alerts"]
        self.assertEqual(len(alerts), 1)
        self.assertEqual((alerts[0]["status"], alerts[0]["percent"]), ("over", 150.0))

    def test_one_budget_per_category_and_expense_only(self):
        self.assertEqual(
            self.client.post("/api/budgets/", {"category": str(self.food.id), "amount": "1"}).status_code,
            201,
        )
        dup = self.client.post("/api/budgets/", {"category": str(self.food.id), "amount": "2"})
        self.assertEqual(dup.status_code, 400)
        salary = self.user.categories.get(name="Salaire")
        res = self.client.post("/api/budgets/", {"category": str(salary.id), "amount": "2"})
        self.assertEqual(res.status_code, 400)
