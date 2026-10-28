from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

User = get_user_model()


class DebtTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("awa", "awa@example.com", "pw")
        self.client.force_authenticate(self.user)

    def create(self, **extra):
        data = {"direction": "lent", "person": "Paul", "amount": "5000"}
        data.update(extra)
        res = self.client.post("/api/debts/", data)
        self.assertEqual(res.status_code, 201, res.data)
        return res.data

    def test_partial_repayments_until_settled(self):
        debt = self.create()
        url = f"/api/debts/{debt['id']}/payments/"

        res = self.client.post(url, {"amount": "2000"})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["remaining"], "3000.00")
        self.assertFalse(res.data["settled"])

        # Repaying more than what is left is refused.
        self.assertEqual(self.client.post(url, {"amount": "4000"}).status_code, 400)

        res = self.client.post(url, {"amount": "3000"})
        self.assertTrue(res.data["settled"])
        self.assertEqual(res.data["percent"], 100.0)

        # Undo a repayment.
        payment = res.data["payments"][0]["id"]
        self.assertEqual(self.client.delete(f"/api/debt-payments/{payment}/").status_code, 204)
        self.assertFalse(self.client.get(f"/api/debts/{debt['id']}/").data["settled"])

    def test_dashboard_totals_and_isolation(self):
        self.create(amount="5000")
        self.create(direction="borrowed", person="Maman", amount="10000")
        debts = self.client.get("/api/stats/summary/").data["debts"]
        self.assertEqual(debts, {"owed_to_me": 5000, "i_owe": 10000})

        other = User.objects.create_user("bob", "bob@example.com", "pw")
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get("/api/debts/").data, [])

    def test_summary_has_trend_and_last_month(self):
        data = self.client.get("/api/stats/summary/").data
        self.assertEqual(len(data["balance_trend"]), 30)
        self.assertIn("previous_expense", data["last_month"])
