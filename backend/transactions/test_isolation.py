"""Every user only ever sees and touches their own data.

User A creates one of everything; user B then tries to list, read, change, delete and
reuse A's data through every endpoint. Nothing of A's may leak or move.
"""

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

User = get_user_model()


def ids(data):
    rows = data["results"] if isinstance(data, dict) and "results" in data else data
    return {str(row["id"]) for row in rows}


class IsolationTests(APITestCase):
    def setUp(self):
        self.a = User.objects.create_user("alice", "a@example.com", "pw")
        self.b = User.objects.create_user("bob", "b@example.com", "pw")
        today = str(timezone.localdate())

        self.client.force_authenticate(self.a)
        post = lambda url, data: self.client.post(url, data, format="json").data  # noqa: E731
        self.cat = str(self.a.categories.filter(type="expense").first().id)
        self.acc = post("/api/accounts/", {"name": "MoMo A", "type": "mobile_money"})["id"]
        self.acc2 = str(self.a.accounts.exclude(id=self.acc).first().id)
        self.tx = post(
            "/api/transactions/",
            {"type": "expense", "amount": "500", "category": self.cat, "date": today},
        )["id"]
        self.transfer = post(
            "/api/transfers/",
            {"from_account": self.acc, "to_account": self.acc2, "amount": "100", "date": today},
        )["id"]
        self.budget = post("/api/budgets/", {"category": self.cat, "amount": "1000"})["id"]
        self.goal = post("/api/goals/", {"name": "Moto", "target_amount": "50000"})["id"]
        post(f"/api/goals/{self.goal}/contributions/", {"amount": "1000"})
        self.contribution = self.client.get(f"/api/goals/{self.goal}/contributions/").data[0]["id"]
        self.rule = post(
            "/api/recurring/",
            {"type": "expense", "amount": "300", "category": self.cat, "start_date": today},
        )["id"]
        debt = post("/api/debts/", {"direction": "lent", "person": "Paul", "amount": "5000"})
        self.debt = debt["id"]
        self.payment = post(f"/api/debts/{self.debt}/payments/", {"amount": "1000"})["payments"][
            0
        ]["id"]

        self.client.force_authenticate(self.b)

    def test_lists_never_show_other_users_data(self):
        a_ids = {
            self.cat, self.acc, self.tx, self.transfer, self.budget, self.goal, self.rule,
            self.debt,
        }  # fmt: skip
        for url in [
            "/api/categories/",
            "/api/accounts/",
            "/api/transactions/",
            "/api/transfers/",
            "/api/budgets/",
            "/api/goals/",
            "/api/recurring/",
            "/api/debts/",
        ]:
            res = self.client.get(url)
            self.assertEqual(res.status_code, 200, url)
            self.assertFalse(ids(res.data) & a_ids, f"{url} leaks another user's data")

    def test_cannot_read_change_or_delete_other_users_objects(self):
        for url in [
            f"/api/categories/{self.cat}/",
            f"/api/accounts/{self.acc}/",
            f"/api/transactions/{self.tx}/",
            f"/api/transfers/{self.transfer}/",
            f"/api/budgets/{self.budget}/",
            f"/api/goals/{self.goal}/",
            f"/api/recurring/{self.rule}/",
            f"/api/debts/{self.debt}/",
        ]:
            self.assertEqual(self.client.get(url).status_code, 404, url)
            # 405 = this kind of object can't be edited at all (transfers): no access either.
            self.assertIn(self.client.patch(url, {}, format="json").status_code, (404, 405), url)
            self.assertEqual(self.client.delete(url).status_code, 404, url)
        for url in [
            f"/api/goal-contributions/{self.contribution}/",
            f"/api/debt-payments/{self.payment}/",
        ]:
            self.assertEqual(self.client.delete(url).status_code, 404, url)
        # Actions on someone else's objects.
        for url, data in [
            (f"/api/goals/{self.goal}/contributions/", {"amount": "1"}),
            (f"/api/debts/{self.debt}/payments/", {"amount": "1"}),
            (f"/api/recurring/{self.rule}/confirm/", {}),
            (f"/api/recurring/{self.rule}/skip/", {}),
        ]:
            self.assertEqual(self.client.post(url, data, format="json").status_code, 404, url)

    def test_cannot_attach_own_data_to_other_users_category_or_account(self):
        today = str(timezone.localdate())
        attempts = [
            ("/api/transactions/", {"type": "expense", "amount": "1", "category": self.cat, "date": today}),
            ("/api/budgets/", {"category": self.cat, "amount": "1"}),
            ("/api/recurring/", {"type": "expense", "amount": "1", "category": self.cat, "start_date": today}),
            ("/api/transfers/", {"from_account": self.acc, "to_account": self.acc2, "amount": "1", "date": today}),
            ("/api/imports/commit/", {"account": self.acc, "rows": [], "mapping": {}}),
        ]  # fmt: skip
        own_cat = str(self.b.categories.filter(type="expense").first().id)
        attempts.append(
            (
                "/api/transactions/",
                {"type": "expense", "amount": "1", "category": own_cat, "account": self.acc, "date": today},
            )
        )  # fmt: skip
        for url, data in attempts:
            res = self.client.post(url, data, format="json")
            self.assertEqual(res.status_code, 400, f"{url} accepted another user's object")

    def test_totals_only_count_own_data(self):
        summary = self.client.get("/api/stats/summary/").data
        self.assertEqual(summary["month"]["expense"], 0)
        self.assertEqual(summary["debts"]["owed_to_me"], 0)
        self.assertEqual(summary["recent_transactions"], [])

    def test_nothing_of_a_was_modified(self):
        self.test_cannot_read_change_or_delete_other_users_objects()
        self.client.force_authenticate(self.a)
        self.assertEqual(self.client.get(f"/api/transactions/{self.tx}/").data["amount"], "500.00")
        self.assertEqual(self.client.get(f"/api/goals/{self.goal}/").data["saved_amount"], "1000.00")
        self.assertEqual(self.client.get(f"/api/debts/{self.debt}/").data["remaining"], "4000.00")
