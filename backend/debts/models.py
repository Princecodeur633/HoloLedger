import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class Debt(models.Model):
    """Money lent to someone ("on me doit") or borrowed from someone ("je dois").

    Tracked on its own: it does not change the balance of the accounts.
    """

    class Direction(models.TextChoices):
        LENT = "lent", "On me doit"
        BORROWED = "borrowed", "Je dois"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="debts"
    )
    direction = models.CharField(max_length=10, choices=Direction.choices)
    person = models.CharField(max_length=80)
    amount = models.DecimalField(
        max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    description = models.CharField(max_length=255, blank=True)
    date = models.DateField(default=timezone.localdate)
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.get_direction_display()} · {self.person} · {self.amount}"


class DebtPayment(models.Model):
    """A (partial) repayment of a debt."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    debt = models.ForeignKey(Debt, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(
        max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    date = models.DateField(default=timezone.localdate)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.debt.person} : {self.amount}"
