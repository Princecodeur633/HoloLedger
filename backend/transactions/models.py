import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class Transaction(models.Model):
    class Type(models.TextChoices):
        INCOME = "income", "Revenu"
        EXPENSE = "expense", "Dépense"

    class PaymentMethod(models.TextChoices):
        CASH = "cash", "Espèces"
        MOBILE_MONEY = "mobile_money", "Mobile Money"
        CARD = "card", "Carte"
        TRANSFER = "transfer", "Virement"
        OTHER = "other", "Autre"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="transactions"
    )
    type = models.CharField(max_length=10, choices=Type.choices)
    amount = models.DecimalField(
        max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    currency = models.CharField(max_length=3, default="XAF")
    date = models.DateField(default=timezone.localdate)
    description = models.CharField(max_length=255, blank=True)
    category = models.ForeignKey(
        "categories.Category", on_delete=models.PROTECT, related_name="transactions"
    )
    account = models.ForeignKey(
        "accounts.Account", on_delete=models.PROTECT, related_name="transactions"
    )
    recurring_rule = models.ForeignKey(
        "recurring.RecurringRule",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions",
    )
    source = models.CharField(max_length=255, blank=True)
    payment_method = models.CharField(
        max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CASH
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        indexes = [models.Index(fields=["user", "date"])]

    def save(self, *args, **kwargs):
        if self.account_id is None:
            from accounts.models import default_account

            self.account = default_account(self.user)
        super().save(*args, **kwargs)

    def __str__(self):
        sign = "+" if self.type == self.Type.INCOME else "-"
        return f"{sign}{self.amount} {self.currency} ({self.date})"
