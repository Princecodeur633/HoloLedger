import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Budget(models.Model):
    """Monthly spending limit for one expense category."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="budgets"
    )
    category = models.ForeignKey(
        "categories.Category", on_delete=models.CASCADE, related_name="budgets"
    )
    amount = models.DecimalField(
        max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    # Share of the limit (in %) from which the budget is flagged as "warning".
    alert_threshold = models.PositiveSmallIntegerField(default=80)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category__name"]
        constraints = [
            models.UniqueConstraint(fields=["user", "category"], name="unique_budget_per_category")
        ]

    def __str__(self):
        return f"{self.category} : {self.amount}"
