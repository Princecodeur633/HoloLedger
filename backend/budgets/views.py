from rest_framework import viewsets

from transactions.stats import parse_ref_date

from .models import Budget
from .serializers import BudgetSerializer
from .usage import budget_usage


class BudgetViewSet(viewsets.ModelViewSet):
    """Monthly budgets; `?date=YYYY-MM-DD` picks the month used for consumption."""

    serializer_class = BudgetSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Budget.objects.filter(user=self.request.user).select_related("category")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action in ("list", "retrieve"):
            budgets = self.get_queryset()
            if self.action == "retrieve":
                budgets = budgets.filter(pk=self.kwargs["pk"])
            context["usage"] = budget_usage(budgets, parse_ref_date(self.request))
        return context

    def perform_create(self, serializer):
        budget = serializer.save(user=self.request.user)
        serializer.context["usage"] = budget_usage([budget], parse_ref_date(self.request))

    def perform_update(self, serializer):
        budget = serializer.save()
        serializer.context["usage"] = budget_usage([budget], parse_ref_date(self.request))
