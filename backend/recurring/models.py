import calendar
import uuid
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class RecurringRule(models.Model):
    """Template for an operation that comes back regularly (rent, salary, subscriptions…)."""

    class Frequency(models.TextChoices):
        WEEKLY = "weekly", "Chaque semaine"
        MONTHLY = "monthly", "Chaque mois"
        YEARLY = "yearly", "Chaque année"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recurring_rules"
    )
    type = models.CharField(max_length=10, choices=[("income", "Revenu"), ("expense", "Dépense")])
    amount = models.DecimalField(
        max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    category = models.ForeignKey(
        "categories.Category", on_delete=models.PROTECT, related_name="recurring_rules"
    )
    account = models.ForeignKey(
        "accounts.Account", on_delete=models.PROTECT, related_name="recurring_rules"
    )
    description = models.CharField(max_length=255, blank=True)
    payment_method = models.CharField(max_length=20, default="cash")
    frequency = models.CharField(max_length=10, choices=Frequency.choices, default=Frequency.MONTHLY)
    interval = models.PositiveSmallIntegerField(default=1)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    # Next occurrence not yet created or skipped. None once the rule is finished.
    next_date = models.DateField(null=True, blank=True)
    # True: created automatically when due. False: shown as "à confirmer".
    auto_confirm = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["next_date", "created_at"]

    def __str__(self):
        return self.description or str(self.category)

    def occurrence_after(self, current):
        """Next date after `current`, keeping the day of `start_date` (clamped to month end)."""
        if self.frequency == self.Frequency.WEEKLY:
            return current + timedelta(weeks=self.interval)
        months = self.interval if self.frequency == self.Frequency.MONTHLY else 12 * self.interval
        index = current.year * 12 + current.month - 1 + months
        year, month = divmod(index, 12)
        month += 1
        day = min(self.start_date.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)

    def advance(self):
        """Move `next_date` to the following occurrence, ending the rule if past end_date."""
        following = self.occurrence_after(self.next_date)
        self.next_date = None if self.end_date and following > self.end_date else following
