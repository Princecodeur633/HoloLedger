from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from rest_framework.test import APITestCase

from .models import Transaction
from .periods import period_bounds

User = get_user_model()


class PeriodBoundsTests(SimpleTestCase):
    ref = date(2026, 10, 26)  # a Monday

    def test_bounds(self):
        cases = {
            "day": (date(2026, 10, 26), date(2026, 10, 26)),
            "week": (date(2026, 10, 26), date(2026, 11, 1)),
            "month": (date(2026, 10, 1), date(2026, 10, 31)),
            "quarter": (date(2026, 10, 1), date(2026, 12, 31)),
            "semester": (date(2026, 7, 1), date(2026, 12, 31)),
            "year": (date(2026, 1, 1), date(2026, 12, 31)),
        }
        for period, expected in cases.items():
            self.assertEqual(period_bounds(period, self.ref), expected, period)

    def test_week_starts_monday_and_february(self):
        self.assertEqual(period_bounds("week", date(2026, 11, 1))[0], date(2026, 10, 26))
        self.assertEqual(period_bounds("month", date(2028, 2, 10))[1], date(2028, 2, 29))
        self.assertEqual(period_bounds("semester", date(2026, 3, 1)), (date(2026, 1, 1), date(2026, 6, 30)))


class TransactionApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("awa", "awa@example.com", "pw")
        self.client.force_authenticate(self.user)
        self.food = self.user.categories.get(name="Alimentation")
        self.salary = self.user.categories.get(name="Salaire")

    def add(self, type_, amount, category, day, **extra):
        return Transaction.objects.create(
            user=self.user, type=type_, amount=Decimal(amount), category=category, date=day, **extra
        )

    def test_create_expense(self):
        res = self.client.post(
            "/api/transactions/",
            {
                "type": "expense",
                "amount": "15000",
                "category": str(self.food.id),
                "date": "2026-10-26",
                "description": "Marché",
                "payment_method": "cash",
            },
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["currency"], "XAF")
        self.assertEqual(res.data["category_detail"]["name"], "Alimentation")

    def test_rejects_non_positive_amount(self):
        res = self.client.post(
            "/api/transactions/", {"type": "expense", "amount": "0", "category": str(self.food.id)}
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("amount", res.data)

    def test_rejects_category_of_wrong_type(self):
        res = self.client.post(
            "/api/transactions/", {"type": "income", "amount": "100", "category": str(self.food.id)}
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("category", res.data)

    def test_rejects_other_users_category(self):
        other = User.objects.create_user("bob", "bob@example.com", "pw")
        foreign = other.categories.get(name="Alimentation")
        res = self.client.post(
            "/api/transactions/", {"type": "expense", "amount": "100", "category": str(foreign.id)}
        )
        self.assertEqual(res.status_code, 400)

    def test_isolation_between_users(self):
        other = User.objects.create_user("bob", "bob@example.com", "pw")
        tx = Transaction.objects.create(
            user=other, type="expense", amount=10, category=other.categories.first()
        )
        self.assertEqual(self.client.get("/api/transactions/").data["count"], 0)
        self.assertEqual(self.client.get(f"/api/transactions/{tx.id}/").status_code, 404)

    def test_update_and_delete(self):
        tx = self.add("expense", "1000", self.food, date(2026, 10, 1))
        res = self.client.patch(f"/api/transactions/{tx.id}/", {"amount": "2500"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(Decimal(res.data["amount"]), Decimal("2500"))
        self.assertEqual(self.client.delete(f"/api/transactions/{tx.id}/").status_code, 204)

    def test_search_and_period_filter(self):
        self.add("expense", "15000", self.food, date(2026, 10, 26), description="Marché")
        self.add("expense", "3000", self.food, date(2026, 9, 2), description="Pain")
        self.add("income", "450000", self.salary, date(2026, 10, 1))

        res = self.client.get("/api/transactions/?search=marché")
        self.assertEqual(res.data["count"], 1)

        res = self.client.get("/api/transactions/?search=alimentation")
        self.assertEqual(res.data["count"], 2)

        res = self.client.get("/api/transactions/?period=month&date=2026-10-15")
        self.assertEqual(res.data["count"], 2)

        res = self.client.get("/api/transactions/?type=expense&date_from=2026-10-01")
        self.assertEqual(res.data["count"], 1)


class StatsApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("awa", "awa@example.com", "pw")
        self.client.force_authenticate(self.user)
        food = self.user.categories.get(name="Alimentation")
        rent = self.user.categories.get(name="Loyer")
        salary = self.user.categories.get(name="Salaire")
        for type_, amount, cat, day in [
            ("income", 450000, salary, date(2026, 10, 1)),
            ("expense", 150000, rent, date(2026, 10, 2)),
            ("expense", 60000, food, date(2026, 10, 20)),
            ("expense", 10000, food, date(2026, 9, 15)),
        ]:
            Transaction.objects.create(
                user=self.user, type=type_, amount=amount, category=cat, date=day
            )

    def test_period_month(self):
        res = self.client.get("/api/stats/period/?period=month&date=2026-10-26")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["income"], Decimal("450000"))
        self.assertEqual(res.data["expense"], Decimal("210000"))
        self.assertEqual(res.data["net"], Decimal("240000"))
        self.assertEqual(len(res.data["series"]), 31)
        self.assertEqual(res.data["series"][1]["expense"], Decimal("150000"))

    def test_period_year_buckets_by_month(self):
        res = self.client.get("/api/stats/period/?period=year&date=2026-10-26")
        self.assertEqual(res.data["bucket"], "month")
        self.assertEqual(len(res.data["series"]), 12)
        self.assertEqual(res.data["series"][8]["expense"], Decimal("10000"))

    def test_invalid_params(self):
        self.assertEqual(self.client.get("/api/stats/period/?period=decade").status_code, 400)
        self.assertEqual(self.client.get("/api/stats/period/?date=26-10-2026").status_code, 400)

    def test_categories_breakdown(self):
        res = self.client.get("/api/stats/categories/?period=month&date=2026-10-26")
        cats = res.data["categories"]
        self.assertEqual([c["category"]["name"] for c in cats], ["Loyer", "Alimentation"])
        self.assertAlmostEqual(cats[0]["percent"], 71.4)

    def test_summary(self):
        res = self.client.get("/api/stats/summary/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["balance"], Decimal("230000"))
        # Amounts are rendered as exact strings, like serializer fields.
        self.assertEqual(Decimal(res.json()["balance"]), Decimal("230000"))
        self.assertIsInstance(res.json()["month"]["expense"], str)
        self.assertEqual(len(res.data["recent_transactions"]), 4)


class InsightsAndExportTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("awa", "awa@example.com", "pw")
        self.client.force_authenticate(self.user)
        food = self.user.categories.get(name="Alimentation")
        salary = self.user.categories.get(name="Salaire")
        account = self.user.accounts.get()
        account.initial_balance = Decimal("10000")
        account.save()
        for type_, amount, cat, day in [
            ("income", 400000, salary, date(2026, 9, 1)),
            ("expense", 100000, food, date(2026, 9, 10)),
            ("income", 450000, salary, date(2026, 10, 1)),
            ("expense", 150000, food, date(2026, 10, 2)),
            ("expense", 30000, food, date(2026, 10, 20)),
        ]:
            Transaction.objects.create(
                user=self.user, type=type_, amount=amount, category=cat, date=day,
                description="Marché; centre",
            )

    def test_insights_compare_with_previous_period(self):
        res = self.client.get("/api/stats/insights/?period=month&date=2025-10-01")
        self.assertEqual(res.status_code, 200)
        res = self.client.get("/api/stats/insights/?period=month&date=2026-10-15")
        data = res.data
        self.assertEqual(data["previous"]["expense"], Decimal("100000"))
        self.assertEqual(data["change"]["expense"], 80.0)
        self.assertEqual(data["change"]["income"], 12.5)
        self.assertEqual(data["savings_rate"], 60.0)
        self.assertEqual(data["top_expenses"][0]["amount"], "150000.00")
        self.assertEqual(data["by_payment_method"][0]["total"], Decimal("180000"))
        history = {str(p["start"]): p["balance"] for p in data["balance_history"]}
        # 10 000 initial + 300 000 (September) + 450 000 − 150 000 by Oct 2nd.
        self.assertEqual(history["2026-10-02"], Decimal("610000"))
        self.assertEqual(history["2026-10-31"], Decimal("580000"))

    def test_csv_export_respects_filters(self):
        res = self.client.get("/api/transactions/export/?type=expense&period=month&date=2026-10-15")
        self.assertEqual(res.status_code, 200)
        self.assertIn("attachment", res["Content-Disposition"])
        lines = res.content.decode("utf-8-sig").strip().splitlines()
        self.assertEqual(lines[0].split(";")[:3], ["Date", "Type", "Montant"])
        self.assertEqual(len(lines), 3)
        self.assertIn('"Marché; centre"', lines[1])
        self.assertIn("150000,00", lines[2] + lines[1])
