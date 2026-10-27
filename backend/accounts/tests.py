from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from transactions.models import Transaction

from .models import Account, Transfer

User = get_user_model()


class AccountTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("awa", "awa@example.com", "pw")
        self.client.force_authenticate(self.user)
        self.cash = self.user.accounts.get()  # created on sign-up
        self.momo = Account.objects.create(
            user=self.user, name="MTN MoMo", type="mobile_money", initial_balance=50000
        )
        self.food = self.user.categories.get(name="Alimentation")

    def test_default_account_created_and_used(self):
        self.assertEqual(self.cash.name, "Espèces")
        res = self.client.post(
            "/api/transactions/",
            {"type": "expense", "amount": "1000", "category": str(self.food.id)},
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["account"], self.cash.id)
        self.assertEqual(res.data["account_name"], "Espèces")

    def test_balances_include_initial_and_transfers(self):
        Transaction.objects.create(
            user=self.user, type="expense", amount=5000, category=self.food, account=self.momo
        )
        res = self.client.post(
            "/api/transfers/",
            {
                "from_account": str(self.momo.id),
                "to_account": str(self.cash.id),
                "amount": "20000",
                "fee": "200",
            },
        )
        self.assertEqual(res.status_code, 201, res.data)

        balances = {a["name"]: Decimal(a["balance"]) for a in self.client.get("/api/accounts/").data}
        # 50 000 − 5 000 − 20 000 − 200 (fee) = 24 800 ; cash receives 20 000.
        self.assertEqual(balances, {"Espèces": Decimal("20000"), "MTN MoMo": Decimal("24800")})

        # The transfer itself is neither income nor expense; only the fee is.
        self.assertEqual(Transaction.objects.filter(user=self.user, type="income").count(), 0)
        fee = Transfer.objects.get().fee_transaction
        self.assertEqual((fee.amount, fee.category.name), (Decimal("200"), "Frais"))

        summary = self.client.get("/api/stats/summary/").data
        self.assertEqual(summary["balance"], Decimal("44800"))

    def test_delete_transfer_removes_fee(self):
        self.client.post(
            "/api/transfers/",
            {"from_account": str(self.momo.id), "to_account": str(self.cash.id), "amount": "100", "fee": "10"},
        )
        transfer = Transfer.objects.get()
        self.assertEqual(self.client.delete(f"/api/transfers/{transfer.id}/").status_code, 204)
        self.assertFalse(Transaction.objects.exists())

    def test_same_account_transfer_rejected(self):
        res = self.client.post(
            "/api/transfers/",
            {"from_account": str(self.cash.id), "to_account": str(self.cash.id), "amount": "100"},
        )
        self.assertEqual(res.status_code, 400)

    def test_account_with_operations_cannot_be_deleted(self):
        Transaction.objects.create(
            user=self.user, type="expense", amount=10, category=self.food, account=self.momo
        )
        self.assertEqual(self.client.delete(f"/api/accounts/{self.momo.id}/").status_code, 409)
        res = self.client.patch(f"/api/accounts/{self.momo.id}/", {"is_archived": True})
        self.assertTrue(res.data["is_archived"])

    def test_other_users_account_rejected(self):
        other = User.objects.create_user("bob", "bob@example.com", "pw")
        res = self.client.post(
            "/api/transactions/",
            {
                "type": "expense",
                "amount": "100",
                "category": str(self.food.id),
                "account": str(other.accounts.get().id),
            },
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("account", res.data)
