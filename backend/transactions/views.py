import csv

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action

from .filters import TransactionFilter
from .models import Transaction
from .serializers import TransactionSerializer

EXPORT_COLUMNS = [
    ("Date", lambda t: t.date.strftime("%d/%m/%Y")),
    ("Type", lambda t: t.get_type_display()),
    ("Montant", lambda t: f"{t.amount:.2f}".replace(".", ",")),
    ("Devise", lambda t: t.currency),
    ("Catégorie", lambda t: t.category.name),
    ("Compte", lambda t: t.account.name),
    ("Description", lambda t: t.description),
    ("Moyen de paiement", lambda t: t.get_payment_method_display()),
    ("Provenance / destination", lambda t: t.source),
    ("Note", lambda t: t.note),
]


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    filterset_class = TransactionFilter
    search_fields = ["description", "category__name", "amount", "source", "note"]
    ordering_fields = ["date", "amount", "created_at"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Transaction.objects.filter(user=self.request.user).select_related(
            "category", "account"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False)
    def export(self, request):
        """CSV of the filtered operations (same filters as the list), readable by Excel FR."""
        transactions = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        filename = f"holoLedger-operations-{timezone.localdate():%Y-%m-%d}.csv"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response.write("﻿")  # BOM so Excel detects UTF-8
        writer = csv.writer(response, delimiter=";")
        writer.writerow([name for name, _ in EXPORT_COLUMNS])
        for tx in transactions.iterator():
            writer.writerow([value(tx) for _, value in EXPORT_COLUMNS])
        return response
