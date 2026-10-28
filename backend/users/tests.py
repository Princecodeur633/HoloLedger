import hashlib
import hmac
import json
import re
from datetime import timedelta
from unittest import mock

from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from categories.models import DEFAULT_CATEGORIES, Category

from .models import User, WhatsAppChallenge


class AuthTests(APITestCase):
    def register(self, **overrides):
        data = {"username": "awa", "phone": "06 123 4567", "password": "Sup3r-secret!"}
        data.update(overrides)
        return self.client.post(reverse("register"), data)

    def test_register_returns_token_and_seeds_categories(self):
        res = self.register()
        self.assertEqual(res.status_code, 201)
        self.assertIn("token", res.data)
        self.assertEqual(res.data["user"]["currency"], "XAF")
        self.assertEqual(res.data["user"]["phone"], "+242061234567")
        self.assertIsNone(res.data["user"]["email"])
        self.assertFalse(res.data["user"]["whatsapp_verified"])
        self.assertEqual(Category.objects.filter(is_default=True).count(), len(DEFAULT_CATEGORIES))

    def test_register_phone_rules(self):
        self.assertEqual(self.register(phone="12").status_code, 400)
        self.register()
        # Same number written differently is still a duplicate.
        res = self.register(username="other", phone="+242 06 123 45 67")
        self.assertEqual(res.status_code, 400)
        self.assertIn("phone", res.data)
        # A DRC number, typed nationally with the country picked next to it.
        res = self.register(username="kin", phone="0991 234 567", phone_country="CD")
        self.assertEqual(res.data["user"]["phone"], "+243991234567")
        # Logging in with that national number works without picking the country.
        login = {"login": "0991234567", "password": "Sup3r-secret!"}
        self.assertEqual(self.client.post(reverse("login"), login).status_code, 200)

    def test_register_rejects_duplicate_email(self):
        self.register(email="awa@example.com")
        res = self.register(username="other", phone="+243991234567", email="AWA@example.com")
        self.assertEqual(res.status_code, 400)
        self.assertIn("email", res.data)

    def test_two_users_without_email(self):
        self.register(email="")
        self.assertEqual(self.register(username="b", phone="+243991234567").status_code, 201)

    def test_login_with_username_phone_or_email_then_me_and_logout(self):
        self.register(email="awa@example.com")
        for login in ("awa", "061234567", "+242 06 123 4567", "awa@example.com"):
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

    def test_changing_phone_clears_whatsapp_verification(self):
        token = self.register().data["token"]
        User.objects.update(whatsapp_verified_at=timezone.now())
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        res = self.client.patch(reverse("me"), {"phone": "+243991234567"})
        self.assertEqual(res.data["phone"], "+243991234567")
        self.assertFalse(res.data["whatsapp_verified"])

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


WHATSAPP = {
    "WHATSAPP_TOKEN": "token",
    "WHATSAPP_PHONE_NUMBER_ID": "123",
    "WHATSAPP_APP_SECRET": "secret",
    "WHATSAPP_VERIFY_TOKEN": "verify-me",
    "WHATSAPP_BUSINESS_NUMBER": "+242 05 000 0000",
}


@override_settings(**WHATSAPP)
@mock.patch("users.whatsapp.send_text", return_value=True)
class WhatsAppTests(APITestCase):
    def setUp(self):
        res = self.client.post(
            reverse("register"),
            {"username": "awa", "phone": "061234567", "password": "Sup3r-secret!"},
        )
        self.token = res.data["token"]

    def webhook(self, text, sender="242061234567"):
        body = json.dumps(
            {
                "entry": [
                    {
                        "changes": [
                            {
                                "value": {
                                    "messages": [
                                        {"from": sender, "type": "text", "text": {"body": text}}
                                    ]
                                }
                            }
                        ]
                    }
                ]
            }
        ).encode()
        signature = hmac.new(b"secret", body, hashlib.sha256).hexdigest()
        return self.client.generic(
            "POST",
            reverse("whatsapp-webhook"),
            body,
            content_type="application/json",
            HTTP_X_HUB_SIGNATURE_256=f"sha256={signature}",
        )

    def message_from(self, url):
        """The text pre-filled in the wa.me link."""
        from urllib.parse import unquote

        self.assertTrue(url.startswith("https://wa.me/242050000000?text="))
        return unquote(url.split("text=")[1])

    def test_status(self, send):
        self.assertTrue(self.client.get(reverse("whatsapp-status")).data["enabled"])
        with override_settings(WHATSAPP_TOKEN=""):
            self.assertFalse(self.client.get(reverse("whatsapp-status")).data["enabled"])

    def test_webhook_subscription(self, send):
        url = reverse("whatsapp-webhook")
        params = {"hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "42"}
        res = self.client.get(url, params)
        self.assertEqual(res.content, b"42")
        self.assertEqual(self.client.get(url, {**params, "hub.verify_token": "x"}).status_code, 403)

    def test_webhook_rejects_bad_signature(self, send):
        res = self.client.generic(
            "POST",
            reverse("whatsapp-webhook"),
            b"{}",
            content_type="application/json",
            HTTP_X_HUB_SIGNATURE_256="sha256=forged",
        )
        self.assertEqual(res.status_code, 403)

    def test_verify_number(self, send):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token}")
        url = self.client.post(reverse("whatsapp-verify")).data["url"]
        self.assertEqual(self.webhook(self.message_from(url)).status_code, 200)
        self.assertTrue(self.client.get(reverse("me")).data["whatsapp_verified"])
        self.assertIn("vérifié", send.call_args.args[1])

    def test_message_from_another_number_is_refused(self, send):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token}")
        url = self.client.post(reverse("whatsapp-verify")).data["url"]
        self.webhook(self.message_from(url), sender="243991234567")
        self.assertFalse(self.client.get(reverse("me")).data["whatsapp_verified"])
        self.assertIn("inconnu", send.call_args.args[1])

    def test_password_reset(self, send):
        url = self.client.post(reverse("password-reset-start"), {"phone": "06 123 4567"}).data["url"]
        self.webhook(self.message_from(url))
        code = re.search(r"\d{6}", send.call_args.args[1]).group()
        reset = reverse("password-reset")

        wrong = "000000" if code != "000000" else "111111"
        res = self.client.post(reset, {"phone": "061234567", "code": wrong, "new_password": "N0uveau-secret!"})
        self.assertIn("code", res.data)
        res = self.client.post(reset, {"phone": "061234567", "code": code, "new_password": "N0uveau-secret!"})
        self.assertEqual(res.status_code, 204)

        # Old sessions are closed, the new password works, and the code is single use.
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token}")
        self.assertEqual(self.client.get(reverse("me")).status_code, 401)
        self.client.credentials()
        login = {"login": "061234567", "password": "N0uveau-secret!"}
        self.assertEqual(self.client.post(reverse("login"), login).status_code, 200)
        res = self.client.post(reset, {"phone": "061234567", "code": code, "new_password": "Autre-secret-9"})
        self.assertIn("code", res.data)

    def test_reset_code_expires_and_attempts_are_limited(self, send):
        url = self.client.post(reverse("password-reset-start"), {"phone": "061234567"}).data["url"]
        self.webhook(self.message_from(url))
        code = re.search(r"\d{6}", send.call_args.args[1]).group()
        reset = reverse("password-reset")
        data = {"phone": "061234567", "code": code, "new_password": "N0uveau-secret!"}

        WhatsAppChallenge.objects.update(attempts=WhatsAppChallenge.MAX_ATTEMPTS)
        self.assertIn("code", self.client.post(reset, data).data)
        WhatsAppChallenge.objects.update(
            attempts=0, confirmed_at=timezone.now() - timedelta(minutes=11)
        )
        self.assertIn("code", self.client.post(reset, data).data)

    def test_unknown_number_gets_the_same_answer(self, send):
        res = self.client.post(reverse("password-reset-start"), {"phone": "+243991234567"})
        self.assertEqual(res.status_code, 200)
        self.assertIn("url", res.data)
        self.assertFalse(WhatsAppChallenge.objects.exists())

    def test_rate_limit(self, send):
        for _ in range(5):
            self.client.post(reverse("password-reset-start"), {"phone": "061234567"})
        res = self.client.post(reverse("password-reset-start"), {"phone": "061234567"})
        self.assertEqual(res.status_code, 429)

    def test_disabled(self, send):
        with override_settings(WHATSAPP_TOKEN=""):
            res = self.client.post(reverse("password-reset-start"), {"phone": "061234567"})
        self.assertEqual(res.status_code, 503)
