import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class Account(models.Model):
    """Where the money is: cash, a Mobile Money wallet, a bank account…"""

    class Type(models.TextChoices):
        CASH = "cash", "Espèces"
        MOBILE_MONEY = "mobile_money", "Mobile Money"
        BANK = "bank", "Banque"
        SAVINGS = "savings", "Épargne"
        OTHER = "other", "Autre"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="accounts"
    )
    name = models.CharField(max_length=60)
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.CASH)
    initial_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    color = models.CharField(max_length=20, default="#64748b")
    icon = models.CharField(max_length=40, default="wallet")
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["is_archived", "created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "name"], name="unique_account_name_per_user")
        ]

    def __str__(self):
        return self.name


DEFAULT_ACCOUNT = {"name": "Espèces", "type": Account.Type.CASH, "color": "#22c55e", "icon": "wallet"}


def default_account(user):
    """The account used when none is given (first active one, created if missing)."""
    account = user.accounts.filter(is_archived=False).order_by("created_at").first()
    return account or Account.objects.create(user=user, **DEFAULT_ACCOUNT)


class Transfer(models.Model):
    """Money moved between two accounts: neither an income nor an expense.

    An optional fee is recorded as a real expense transaction on the source account.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="transfers"
    )
    from_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name="transfers_out"
    )
    to_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="transfers_in")
    amount = models.DecimalField(
        max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    fee = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    fee_transaction = models.OneToOneField(
        "transactions.Transaction",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fee_of_transfer",
    )
    date = models.DateField(default=timezone.localdate)
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.from_account} → {self.to_account} : {self.amount}"
