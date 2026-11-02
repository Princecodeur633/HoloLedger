import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Budget(models.Model):
    """Spending limit for one expense category over a month, quarter, semester or year."""

    class Period(models.TextChoices):
        MONTH = "month", "Par mois"
        QUARTER = "quarter", "Par trimestre"
        SEMESTER = "semester", "Par semestre"
        YEAR = "year", "Par année"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="budgets"
    )
    space = models.ForeignKey(
        "spaces.Space", on_delete=models.CASCADE, related_name="budgets"
    )
    category = models.ForeignKey(
        "categories.Category", on_delete=models.CASCADE, related_name="budgets"
    )
    amount = models.DecimalField(
        max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    period = models.CharField(max_length=10, choices=Period.choices, default=Period.MONTH)
    # Share of the limit (in %) from which the budget is flagged as "warning".
    alert_threshold = models.PositiveSmallIntegerField(default=80)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["space", "category"], name="unique_budget_per_category_space"
            )
        ]

    def __str__(self):
        return f"{self.category} : {self.amount}"
