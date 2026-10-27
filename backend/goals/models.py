import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class Goal(models.Model):
    """Savings goal; progress is the sum of its contributions."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="goals"
    )
    name = models.CharField(max_length=80)
    target_amount = models.DecimalField(
        max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    deadline = models.DateField(null=True, blank=True)
    color = models.CharField(max_length=20, default="#22c55e")
    icon = models.CharField(max_length=40, default="piggy-bank")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["deadline", "created_at"]

    def __str__(self):
        return self.name


class GoalContribution(models.Model):
    """Money put aside for a goal (negative amount = withdrawal)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name="contributions")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    date = models.DateField(default=timezone.localdate)
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.goal} : {self.amount}"
