from datetime import date

import django_filters
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Transaction
from .periods import PERIODS, period_bounds


class TransactionFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    period = django_filters.ChoiceFilter(
        choices=[(p, p) for p in PERIODS], method="filter_period"
    )
    min_amount = django_filters.NumberFilter(field_name="amount", lookup_expr="gte")
    max_amount = django_filters.NumberFilter(field_name="amount", lookup_expr="lte")

    class Meta:
        model = Transaction
        fields = ["type", "category", "account", "payment_method"]

    def filter_period(self, queryset, name, value):
        raw = self.data.get("date")
        try:
            ref = date.fromisoformat(raw) if raw else timezone.localdate()
        except ValueError:
            raise ValidationError({"date": "Format attendu : AAAA-MM-JJ."})
        start, end = period_bounds(value, ref)
        return queryset.filter(date__range=(start, end))
