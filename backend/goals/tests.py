from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

User = get_user_model()


class GoalTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("awa", "awa@example.com", "pw")
        self.client.force_authenticate(self.user)

    def test_progress_with_contributions(self):
        goal = self.client.post(
            "/api/goals/", {"name": "Moto", "target_amount": "500000", "deadline": "2027-06-30"}
        ).data
        self.assertEqual(goal["percent"], 0)

        url = f"/api/goals/{goal['id']}/contributions/"
        self.client.post(url, {"amount": "200000"})
        res = self.client.post(url, {"amount": "-50000", "note": "Imprévu"})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["goal"]["saved_amount"], "150000.00")
        self.assertEqual(res.data["goal"]["percent"], 30.0)
        self.assertEqual(res.data["goal"]["remaining"], "350000.00")
        self.assertFalse(res.data["goal"]["reached"])

        self.client.post(url, {"amount": "400000"})
        goal = self.client.get(f"/api/goals/{goal['id']}/").data
        self.assertTrue(goal["reached"])
        self.assertEqual(goal["percent"], 100.0)
        self.assertEqual(len(self.client.get(url).data), 3)

    def test_zero_contribution_rejected_and_isolation(self):
        goal = self.client.post("/api/goals/", {"name": "Fonds", "target_amount": "1000"}).data
        url = f"/api/goals/{goal['id']}/contributions/"
        self.assertEqual(self.client.post(url, {"amount": "0"}).status_code, 400)

        other = User.objects.create_user("bob", "bob@example.com", "pw")
        self.client.force_authenticate(other)
        self.assertEqual(self.client.post(url, {"amount": "10"}).status_code, 404)
        self.assertEqual(self.client.get("/api/goals/").data, [])

    def test_delete_contribution(self):
        goal = self.client.post("/api/goals/", {"name": "Fonds", "target_amount": "1000"}).data
        res = self.client.post(f"/api/goals/{goal['id']}/contributions/", {"amount": "100"})
        contribution = res.data["contribution"]["id"]
        self.assertEqual(self.client.delete(f"/api/goal-contributions/{contribution}/").status_code, 204)
        self.assertEqual(
            Decimal(self.client.get(f"/api/goals/{goal['id']}/").data["saved_amount"]), Decimal("0")
        )
