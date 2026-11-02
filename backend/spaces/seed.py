"""Starting categories and account of a new space, adapted to its kind."""

from accounts.models import Account
from categories.models import DEFAULT_CATEGORIES, Category

from .models import Space

# (name, type, color, icon)
COUPLE_CATEGORIES = [
    ("Courses", "expense", "#f97316", "shopping-basket"),
    ("Loyer", "expense", "#8b5cf6", "home"),
    ("Factures", "expense", "#eab308", "receipt"),
    ("Transport", "expense", "#3b82f6", "bus"),
    ("Enfants", "expense", "#06b6d4", "baby"),
    ("Santé", "expense", "#ef4444", "heart-pulse"),
    ("Sorties", "expense", "#ec4899", "party-popper"),
    ("Famille", "expense", "#14b8a6", "users"),
    ("Autre dépense", "expense", "#64748b", "tag"),
    ("Contribution", "income", "#22c55e", "piggy-bank"),
    ("Autre revenu", "income", "#64748b", "tag"),
]

BUSINESS_CATEGORIES = [
    ("Achat de marchandises", "expense", "#f97316", "shopping-basket"),
    ("Salaires", "expense", "#8b5cf6", "users"),
    ("Loyer du local", "expense", "#a855f7", "store"),
    ("Transport", "expense", "#3b82f6", "bus"),
    ("Électricité et eau", "expense", "#eab308", "zap"),
    ("Communication", "expense", "#06b6d4", "smartphone"),
    ("Taxes et impôts", "expense", "#ef4444", "receipt"),
    ("Fournitures", "expense", "#14b8a6", "briefcase"),
    ("Autre dépense", "expense", "#64748b", "tag"),
    ("Ventes", "income", "#22c55e", "store"),
    ("Prestations", "income", "#10b981", "laptop"),
    ("Apport", "income", "#0ea5e9", "piggy-bank"),
    ("Autre revenu", "income", "#64748b", "tag"),
]

CATEGORIES = {
    Space.Kind.PERSONAL: DEFAULT_CATEGORIES,
    Space.Kind.COUPLE: COUPLE_CATEGORIES,
    Space.Kind.BUSINESS: BUSINESS_CATEGORIES,
}

DEFAULT_ACCOUNTS = {
    Space.Kind.PERSONAL: {"name": "Espèces", "type": Account.Type.CASH, "color": "#22c55e", "icon": "wallet"},
    Space.Kind.COUPLE: {"name": "Compte commun", "type": Account.Type.CASH, "color": "#ec4899", "icon": "wallet"},
    Space.Kind.BUSINESS: {"name": "Caisse", "type": Account.Type.CASH, "color": "#f97316", "icon": "wallet"},
}


def seed_space(space, user):
    Category.objects.bulk_create(
        [
            Category(
                space=space,
                user=user,
                name=name,
                type=type_,
                color=color,
                icon=icon,
                is_default=True,
            )
            for name, type_, color, icon in CATEGORIES[space.kind]
        ],
        ignore_conflicts=True,
    )
    if not space.accounts.exists():
        Account.objects.create(space=space, user=user, **DEFAULT_ACCOUNTS[space.kind])
