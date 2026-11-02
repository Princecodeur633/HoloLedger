import uuid

from django.conf import settings
from django.db import models


class Space(models.Model):
    """A separate money world: personal, couple (2 people) or business (alone or as a duo).

    Accounts, categories, operations, budgets… all belong to one space; members of a space
    share everything in it, and nothing leaks between spaces.
    """

    class Kind(models.TextChoices):
        PERSONAL = "personal", "Personnel"
        COUPLE = "couple", "Couple"
        BUSINESS = "business", "Business"
        TONTINE = "tontine", "Tontine"
        FAMILY = "family", "Famille"

    MAX_MEMBERS = {
        Kind.PERSONAL: 1,
        Kind.COUPLE: 2,
        Kind.BUSINESS: 2,
        Kind.TONTINE: 50,
        Kind.FAMILY: 50,
    }
    DEFAULT_ICON = {
        Kind.PERSONAL: "👤",
        Kind.COUPLE: "💑",
        Kind.BUSINESS: "💼",
        Kind.TONTINE: "🔄",
        Kind.FAMILY: "👨‍👩‍👧",
    }
    # Contribution groups: members, declared payments validated by a manager.
    GROUP_KINDS = (Kind.TONTINE, Kind.FAMILY)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    name = models.CharField(max_length=60)
    icon = models.CharField(max_length=8, blank=True)
    currency = models.CharField(max_length=3, default="XAF")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.get_kind_display()} · {self.name}"

    def save(self, *args, **kwargs):
        if not self.icon:
            self.icon = self.DEFAULT_ICON[self.kind]
        super().save(*args, **kwargs)

    @property
    def max_members(self):
        return self.MAX_MEMBERS[self.kind]

    @property
    def is_group(self):
        return self.kind in self.GROUP_KINDS


class Membership(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner", "Créateur"
        MANAGER = "manager", "Gestionnaire"
        MEMBER = "member", "Membre"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    space = models.ForeignKey(Space, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["joined_at"]
        constraints = [
            models.UniqueConstraint(fields=["space", "user"], name="unique_membership")
        ]

    def __str__(self):
        return f"{self.user} ∈ {self.space}"

    @property
    def is_manager(self):
        return self.role in (self.Role.OWNER, self.Role.MANAGER)


class Invitation(models.Model):
    """Invitation to join a couple / business space, addressed to a phone number.

    The invitee may not have an account yet: it waits for them and shows up after sign-up.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        ACCEPTED = "accepted", "Acceptée"
        DECLINED = "declined", "Refusée"
        CANCELLED = "cancelled", "Annulée"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    space = models.ForeignKey(Space, on_delete=models.CASCADE, related_name="invitations")
    inviter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_invitations"
    )
    phone = models.CharField(max_length=20)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.phone} → {self.space} ({self.get_status_display()})"
