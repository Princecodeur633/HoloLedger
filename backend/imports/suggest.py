"""Category suggestion: learn from the user's history first, then fall back on keywords."""

from categories.models import Category
from transactions.models import Transaction

from .sms import _plain

# Keyword → default category name (see categories.models.DEFAULT_CATEGORIES).
KEYWORDS = {
    "expense": [
        (("supermarche", "marche", "carrefour", "casino", "boulangerie", "restaurant", "snack"), "Alimentation"),
        (("taxi", "moto", "carburant", "essence", "totalenergies", "tradex", "bus", "uber", "yango"), "Transport"),
        (("loyer", "bail"), "Loyer"),
        (("eneo", "camwater", "electricit", "internet", "canal", "facture", "credit tel", "forfait"), "Factures"),
        (("pharmacie", "hopital", "clinique", "medecin", "sante"), "Santé"),
        (("ecole", "scolarit", "universit", "formation", "livre"), "Éducation"),
        (("cinema", "netflix", "spotify", "sortie"), "Divertissement"),
        (("frais", "commission", "agios"), "Frais"),
    ],
    "income": [
        (("salaire", "paie", "virement employeur"), "Salaire"),
        (("remboursement", "rembourse"), "Remboursement"),
        (("vente",), "Vente"),
    ],
}
FALLBACK = {"expense": "Autre dépense", "income": "Autre revenu"}


class CategorySuggester:
    def __init__(self, user):
        self.categories = list(Category.objects.filter(user=user))
        self.history = {}
        recent = (
            Transaction.objects.filter(user=user)
            .exclude(description="")
            .order_by("date", "created_at")
            .values_list("description", "type", "category_id")
        )
        for description, type_, category_id in recent:  # later rows win
            self.history[(_plain(description).strip(), type_)] = category_id

    def _by_name(self, name, type_):
        for category in self.categories:
            if category.name == name and category.accepts(type_):
                return category.id
        return None

    def suggest(self, description, type_):
        key = (_plain(description or "").strip(), type_)
        if key in self.history:
            return self.history[key]
        plain = key[0]
        for words, name in KEYWORDS.get(type_, []):
            if any(word in plain for word in words):
                found = self._by_name(name, type_)
                if found:
                    return found
        fallback = self._by_name(FALLBACK[type_], type_)
        if fallback:
            return fallback
        return next((c.id for c in self.categories if c.accepts(type_)), None)
