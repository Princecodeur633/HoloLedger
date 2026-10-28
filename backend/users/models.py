import uuid
from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Optional: the phone number is the main contact. NULL (not "") keeps unique=True usable.
    email = models.EmailField("adresse e-mail", unique=True, null=True, blank=True)
    phone = models.CharField("téléphone", max_length=20, unique=True, null=True, blank=True)
    whatsapp_verified_at = models.DateTimeField("WhatsApp vérifié le", null=True, blank=True)
    currency = models.CharField(max_length=3, default="XAF")

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.username

    def save(self, *args, **kwargs):
        # create_user() and the admin form turn a missing e-mail into "", which would collide.
        if not self.email:
            self.email = None
        super().save(*args, **kwargs)


class WhatsAppChallenge(models.Model):
    """A keyword the user sends to the app's WhatsApp number to prove they own their phone.

    For a password reset, the app answers with a 6-digit code, stored hashed.
    """

    KEYWORD_TTL = timedelta(minutes=15)
    CODE_TTL = timedelta(minutes=10)
    MAX_ATTEMPTS = 5

    class Purpose(models.TextChoices):
        RESET = "reset", "Mot de passe oublié"
        VERIFY = "verify", "Vérification du numéro"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="whatsapp_challenges")
    purpose = models.CharField(max_length=10, choices=Purpose.choices)
    keyword = models.CharField(max_length=8, unique=True)
    code_hash = models.CharField(max_length=128, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_purpose_display()} · {self.user}"

    @property
    def keyword_expired(self):
        return timezone.now() > self.created_at + self.KEYWORD_TTL

    @property
    def code_expired(self):
        return self.confirmed_at is None or timezone.now() > self.confirmed_at + self.CODE_TTL
