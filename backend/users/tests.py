from django.urls import reverse
from rest_framework.test import APITestCase

from categories.models import DEFAULT_CATEGORIES, Category


class AuthTests(APITestCase):
    def register(self, **overrides):
        data = {"username": "awa", "email": "awa@example.com", "password": "Sup3r-secret!"}
        data.update(overrides)
        return self.client.post(reverse("register"), data)

    def test_register_returns_token_and_seeds_categories(self):
        res = self.register()
        self.assertEqual(res.status_code, 201)
        self.assertIn("token", res.data)
        self.assertEqual(res.data["user"]["currency"], "XAF")
        self.assertEqual(Category.objects.filter(is_default=True).count(), len(DEFAULT_CATEGORIES))

    def test_register_rejects_duplicate_email(self):
        self.register()
        res = self.register(username="other", email="AWA@example.com")
        self.assertEqual(res.status_code, 400)
        self.assertIn("email", res.data)

    def test_login_with_username_or_email_then_me_and_logout(self):
        self.register()
        for login in ("awa", "awa@example.com"):
            res = self.client.post(reverse("login"), {"login": login, "password": "Sup3r-secret!"})
            self.assertEqual(res.status_code, 200, login)

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {res.data['token']}")
        self.assertEqual(self.client.get(reverse("me")).data["username"], "awa")

        self.assertEqual(self.client.post(reverse("logout")).status_code, 204)
        self.assertEqual(self.client.get(reverse("me")).status_code, 401)

    def test_login_wrong_password(self):
        self.register()
        res = self.client.post(reverse("login"), {"login": "awa", "password": "nope"})
        self.assertEqual(res.status_code, 400)

    def test_me_requires_auth(self):
        self.assertEqual(self.client.get(reverse("me")).status_code, 401)

    def test_change_password(self):
        token = self.register().data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        url = reverse("password-change")

        res = self.client.post(url, {"current_password": "wrong", "new_password": "N0uveau-secret!"})
        self.assertIn("current_password", res.data)
        res = self.client.post(url, {"current_password": "Sup3r-secret!", "new_password": "123"})
        self.assertIn("new_password", res.data)

        res = self.client.post(
            url, {"current_password": "Sup3r-secret!", "new_password": "N0uveau-secret!"}
        )
        self.assertEqual(res.status_code, 204)
        self.assertEqual(self.client.get(reverse("me")).status_code, 200)

        self.client.credentials()
        res = self.client.post(reverse("login"), {"login": "awa", "password": "N0uveau-secret!"})
        self.assertEqual(res.status_code, 200)
