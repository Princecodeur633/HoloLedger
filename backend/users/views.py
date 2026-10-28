import json
import re
import secrets
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db import transaction as db_transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import generics, permissions, serializers, status
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView

from . import whatsapp
from .models import User, WhatsAppChallenge
from .serializers import (
    LoginSerializer,
    PasswordChangeSerializer,
    PasswordResetSerializer,
    PhoneSerializer,
    RegisterSerializer,
    UserSerializer,
)

# No 0/O or 1/I: the keyword may be retyped by hand.
KEYWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
KEYWORD_LABELS = {WhatsAppChallenge.Purpose.RESET: "RESET", WhatsAppChallenge.Purpose.VERIFY: "VERIF"}
KEYWORD_PATTERN = re.compile(r"HOLOLEDGER\s+(?:RESET|VERIF)\s+([A-Z0-9]{6})")
MAX_CHALLENGES_PER_HOUR = 5
INVALID_CODE = "Code invalide ou expiré."


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    @db_transaction.atomic
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token = Token.objects.create(user=user)
        return Response(
            {"token": token.key, "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": UserSerializer(user).data})


class LogoutView(APIView):
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class PasswordChangeView(APIView):
    """The current token stays valid, so the user is not logged out of this device."""

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# --- WhatsApp: number verification and password reset -------------------------------------


def start_challenge(user, purpose):
    """Create a challenge and return the wa.me link carrying its keyword (None if rate limited)."""
    since = timezone.now() - timedelta(hours=1)
    if user.whatsapp_challenges.filter(created_at__gte=since).count() >= MAX_CHALLENGES_PER_HOUR:
        return None
    for _ in range(5):
        keyword = "".join(secrets.choice(KEYWORD_ALPHABET) for _ in range(6))
        try:
            with db_transaction.atomic():
                WhatsAppChallenge.objects.create(user=user, purpose=purpose, keyword=keyword)
            break
        except IntegrityError:
            continue  # keyword already taken: draw another one
    return whatsapp.chat_link(f"HoloLedger {KEYWORD_LABELS[purpose]} {keyword}")


def whatsapp_unavailable():
    return Response(
        {"detail": "La vérification par WhatsApp n’est pas encore activée."},
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


def too_many_requests():
    return Response(
        {"detail": "Trop de demandes. Réessayez dans une heure."},
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


class WhatsAppStatusView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"enabled": whatsapp.is_enabled()})


class WhatsAppVerifyStartView(APIView):
    def post(self, request):
        if not whatsapp.is_enabled():
            return whatsapp_unavailable()
        if not request.user.phone:
            raise serializers.ValidationError({"phone": "Ajoutez d’abord un numéro de téléphone."})
        url = start_challenge(request.user, WhatsAppChallenge.Purpose.VERIFY)
        return Response({"url": url}) if url else too_many_requests()


class PasswordResetStartView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not whatsapp.is_enabled():
            return whatsapp_unavailable()
        serializer = PhoneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(phone=serializer.validated_data["phone"]).first()
        if user is None:
            # Same answer as for a real account, so nobody can probe which numbers are registered.
            keyword = "".join(secrets.choice(KEYWORD_ALPHABET) for _ in range(6))
            return Response({"url": whatsapp.chat_link(f"HoloLedger RESET {keyword}")})
        url = start_challenge(user, WhatsAppChallenge.Purpose.RESET)
        return Response({"url": url}) if url else too_many_requests()


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        challenge = (
            WhatsAppChallenge.objects.filter(
                user__phone=data["phone"],
                purpose=WhatsAppChallenge.Purpose.RESET,
                confirmed_at__isnull=False,
                used_at__isnull=True,
            )
            .select_related("user")
            .first()
        )
        if (
            challenge is None
            or challenge.code_expired
            or challenge.attempts >= WhatsAppChallenge.MAX_ATTEMPTS
        ):
            raise serializers.ValidationError({"code": INVALID_CODE})
        if not check_password(data["code"], challenge.code_hash):
            challenge.attempts += 1
            challenge.save(update_fields=["attempts"])
            raise serializers.ValidationError({"code": INVALID_CODE})

        user = challenge.user
        try:
            validate_password(data["new_password"], user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)}) from None
        user.set_password(data["new_password"])
        user.failed_logins = 0
        user.login_locked_until = None
        user.save(update_fields=["password", "failed_logins", "login_locked_until"])
        challenge.used_at = timezone.now()
        challenge.save(update_fields=["used_at"])
        Token.objects.filter(user=user).delete()  # log out every device that knew the old one
        return Response(status=status.HTTP_204_NO_CONTENT)


def handle_incoming_message(sender, text):
    """React to a message the user sent to the app's WhatsApp number."""
    match = KEYWORD_PATTERN.search(text.upper())
    if not match:
        return
    challenge = (
        WhatsAppChallenge.objects.filter(
            keyword=match.group(1), confirmed_at__isnull=True, used_at__isnull=True
        )
        .select_related("user")
        .first()
    )
    user = challenge.user if challenge else None
    if challenge is None or challenge.keyword_expired or whatsapp.digits(user.phone or "") != sender:
        whatsapp.send_text(
            sender, "Ce code HoloLedger est inconnu ou expiré. Recommencez depuis l’application."
        )
        return

    now = timezone.now()
    if user.whatsapp_verified_at is None:
        user.whatsapp_verified_at = now
        user.save(update_fields=["whatsapp_verified_at"])

    if challenge.purpose == WhatsAppChallenge.Purpose.VERIFY:
        challenge.confirmed_at = challenge.used_at = now
        challenge.save(update_fields=["confirmed_at", "used_at"])
        whatsapp.send_text(sender, "✅ Votre numéro WhatsApp est vérifié pour HoloLedger.")
        return

    code = f"{secrets.randbelow(10**6):06d}"
    challenge.code_hash = make_password(code)
    challenge.confirmed_at = now
    challenge.save(update_fields=["code_hash", "confirmed_at"])
    whatsapp.send_text(
        sender,
        f"Votre code HoloLedger : {code}\n"
        "Il expire dans 10 minutes. Ne le communiquez à personne.",
    )


class WhatsAppWebhookView(APIView):
    """Endpoint registered in the Meta app: GET to subscribe, POST for each incoming message."""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        params = request.query_params
        if (
            whatsapp.is_enabled()
            and params.get("hub.mode") == "subscribe"
            and params.get("hub.verify_token") == settings.WHATSAPP_VERIFY_TOKEN
        ):
            return HttpResponse(params.get("hub.challenge", ""), content_type="text/plain")
        return HttpResponse(status=403)

    def post(self, request):
        body = request.body
        if not whatsapp.is_enabled() or not whatsapp.valid_signature(
            body, request.headers.get("X-Hub-Signature-256", "")
        ):
            return HttpResponse(status=403)
        try:
            payload = json.loads(body)
        except ValueError:
            return HttpResponse(status=400)
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                for message in change.get("value", {}).get("messages", []):
                    if message.get("type") == "text":
                        handle_incoming_message(message["from"], message["text"]["body"])
        # Always 200, otherwise Meta keeps retrying the same message.
        return HttpResponse(status=200)
