"""Tontines and family contribution funds.

Both live in a space of kind "tontine" / "family". They are a tracking book: the money itself
moves by Mobile Money or hand to hand, the app records who paid what and when.
"""

import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class GroupRules(models.Model):
    """How much each member owes, how often, and (tontine) how the pot rotates."""

    class Frequency(models.TextChoices):
        WEEKLY = "weekly", "Chaque semaine"
        BIWEEKLY = "biweekly", "Toutes les 2 semaines"
        MONTHLY = "monthly", "Chaque mois"

    space = models.OneToOneField(
        "spaces.Space", on_delete=models.CASCADE, primary_key=True, related_name="group_rules"
    )
    contribution_amount = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0"), validators=[MinValueValidator(0)]
    )
    frequency = models.CharField(max_length=10, choices=Frequency.choices, default=Frequency.MONTHLY)
    start_date = models.DateField(default=timezone.localdate)
    # Days after the due date before a missing payment is "en retard".
    payment_delay_days = models.PositiveSmallIntegerField(default=3)
    # Optional fine for each late period (0 = none).
    late_penalty = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0"), validators=[MinValueValidator(0)]
    )
    # Optional target: each member's total (tontine) or a family project.
    goal_name = models.CharField(max_length=80, blank=True)
    goal_amount = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )

    def __str__(self):
        return f"Règles de {self.space}"


class GroupMember(models.Model):
    """A participant: with an app account (`user`) or a "carnet" member managed by hand."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    space = models.ForeignKey(
        "spaces.Space", on_delete=models.CASCADE, related_name="group_members"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="group_memberships",
    )
    name = models.CharField(max_length=80)
    phone = models.CharField(max_length=20, blank=True)
    # Family: a member may owe more or less than the default amount (null = default).
    expected_amount = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    # Tontine: order in which members receive the pot (1 = first session).
    position = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["space", "user"],
                condition=models.Q(user__isnull=False),
                name="unique_group_member_user",
            )
        ]

    def __str__(self):
        return self.name


class Contribution(models.Model):
    """A payment into the group: declared by a member, or recorded by a manager."""

    class Status(models.TextChoices):
        PENDING = "pending", "À valider"
        VALIDATED = "validated", "Validé"
        REFUSED = "refused", "Refusé"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    space = models.ForeignKey(
        "spaces.Space", on_delete=models.CASCADE, related_name="contributions"
    )
    member = models.ForeignKey(GroupMember, on_delete=models.CASCADE, related_name="contributions")
    amount = models.DecimalField(
        max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    date = models.DateField(default=timezone.localdate)
    reference = models.CharField(max_length=80, blank=True)  # e.g. Mobile Money transaction id
    note = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    declared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    refusal_reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.member} : {self.amount} ({self.get_status_display()})"


class Payout(models.Model):
    """Tontine: the pot of a session handed to the member whose turn it was."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    space = models.ForeignKey("spaces.Space", on_delete=models.CASCADE, related_name="payouts")
    session = models.PositiveSmallIntegerField()  # 1-based session number
    member = models.ForeignKey(GroupMember, on_delete=models.CASCADE, related_name="payouts")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    date = models.DateField(default=timezone.localdate)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    # Set once the beneficiary has copied it as an income into their personal space.
    recorded_in_personal = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["session"]
        constraints = [
            models.UniqueConstraint(fields=["space", "session"], name="unique_payout_per_session")
        ]


class GroupExpense(models.Model):
    """Family: money taken out of the common fund, always with its purpose."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    space = models.ForeignKey(
        "spaces.Space", on_delete=models.CASCADE, related_name="group_expenses"
    )
    amount = models.DecimalField(
        max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    purpose = models.CharField(max_length=120)
    note = models.CharField(max_length=255, blank=True)
    date = models.DateField(default=timezone.localdate)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.purpose} : {self.amount}"
