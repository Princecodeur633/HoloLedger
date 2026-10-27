from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from transactions.models import Transaction

from .models import Category

User = get_user_model()


class CategoryApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("awa", "awa@example.com", "pw")
        self.other = User.objects.create_user("bob", "bob@example.com", "pw")
        self.client.force_authenticate(self.user)

    def test_list_only_own_categories(self):
        res = self.client.get("/api/categories/")
        self.assertEqual(res.status_code, 200)
        owners = {Category.objects.get(pk=c["id"]).user_id for c in res.data}
        self.assertEqual(owners, {self.user.id})

    def test_filter_by_type(self):
        res = self.client.get("/api/categories/?type=income")
        self.assertTrue(res.data)
        self.assertTrue(all(c["type"] == "income" for c in res.data))

    def test_create_custom_category(self):
        res = self.client.post(
            "/api/categories/", {"name": "Tontine", "type": "both", "color": "#000", "icon": "coins"}
        )
        self.assertEqual(res.status_code, 201)
        self.assertFalse(res.data["is_default"])

    def test_duplicate_name_rejected(self):
        res = self.client.post("/api/categories/", {"name": "transport", "type": "expense"})
        self.assertEqual(res.status_code, 400)

    def test_cannot_touch_other_users_category(self):
        foreign = self.other.categories.first()
        self.assertEqual(self.client.delete(f"/api/categories/{foreign.id}/").status_code, 404)

    def test_delete_used_category_conflicts(self):
        cat = self.user.categories.get(name="Transport")
        Transaction.objects.create(user=self.user, type="expense", amount=500, category=cat)
        res = self.client.delete(f"/api/categories/{cat.id}/")
        self.assertEqual(res.status_code, 409)
