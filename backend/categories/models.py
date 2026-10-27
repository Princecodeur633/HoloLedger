import uuid

from django.conf import settings
from django.db import models


class Category(models.Model):
    class Type(models.TextChoices):
        INCOME = "income", "Revenu"
        EXPENSE = "expense", "Dépense"
        BOTH = "both", "Les deux"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="categories"
    )
    name = models.CharField(max_length=60)
    type = models.CharField(max_length=10, choices=Type.choices)
    color = models.CharField(max_length=20, default="#64748b")
    icon = models.CharField(max_length=40, default="tag")
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["type", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "name", "type"], name="unique_category_per_user"
            )
        ]

    def __str__(self):
        return self.name

    def accepts(self, transaction_type):
        return self.type in (self.Type.BOTH, transaction_type)


# (name, type, color, icon) seeded for every new user.
DEFAULT_CATEGORIES = [
    ("Alimentation", "expense", "#f97316", "shopping-basket"),
    ("Transport", "expense", "#3b82f6", "bus"),
    ("Loyer", "expense", "#8b5cf6", "home"),
    ("Factures", "expense", "#eab308", "receipt"),
    ("Santé", "expense", "#ef4444", "heart-pulse"),
    ("Éducation", "expense", "#06b6d4", "graduation-cap"),
    ("Divertissement", "expense", "#ec4899", "party-popper"),
    ("Famille", "expense", "#14b8a6", "users"),
    ("Autre dépense", "expense", "#64748b", "tag"),
    ("Salaire", "income", "#22c55e", "briefcase"),
    ("Freelance", "income", "#10b981", "laptop"),
    ("Vente", "income", "#84cc16", "store"),
    ("Cadeau", "income", "#f43f5e", "gift"),
    ("Remboursement", "income", "#0ea5e9", "rotate-ccw"),
    ("Autre revenu", "income", "#64748b", "tag"),
]


def create_default_categories(user):
    Category.objects.bulk_create(
        [
            Category(user=user, name=name, type=type_, color=color, icon=icon, is_default=True)
            for name, type_, color, icon in DEFAULT_CATEGORIES
        ],
        ignore_conflicts=True,
    )
