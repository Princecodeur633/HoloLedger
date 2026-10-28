from decimal import Decimal

from django.db.models import DecimalField, Sum, Value
from django.db.models.functions import Coalesce
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Debt, DebtPayment
from .serializers import DebtPaymentSerializer, DebtSerializer

ZERO = Value(Decimal("0"), output_field=DecimalField(max_digits=14, decimal_places=2))


def with_repaid(queryset):
    return queryset.annotate(repaid=Coalesce(Sum("payments__amount"), ZERO))


def open_totals(user):
    """Remaining amounts still owed, by direction (used by the dashboard)."""
    totals = {Debt.Direction.LENT: Decimal("0"), Debt.Direction.BORROWED: Decimal("0")}
    for debt in with_repaid(Debt.objects.filter(user=user)):
        totals[debt.direction] += max(debt.amount - debt.repaid, Decimal("0"))
    return {"owed_to_me": totals[Debt.Direction.LENT], "i_owe": totals[Debt.Direction.BORROWED]}


class DebtViewSet(viewsets.ModelViewSet):
    serializer_class = DebtSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return with_repaid(Debt.objects.filter(user=self.request.user)).prefetch_related(
            "payments"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def payments(self, request, pk=None):
        """Record a repayment; it cannot exceed what is still owed."""
        debt = self.get_object()
        serializer = DebtPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        remaining = debt.amount - debt.repaid
        if serializer.validated_data["amount"] > remaining:
            raise serializers.ValidationError(
                {"amount": f"Il ne reste que {remaining:.0f} à rembourser."}
            )
        serializer.save(debt=debt)
        return Response(self.get_serializer(self.get_object()).data, status=status.HTTP_201_CREATED)


class DebtPaymentViewSet(mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Only deletion (to undo a mistake): repayments are created through /debts/{id}/payments/."""

    serializer_class = DebtPaymentSerializer

    def get_queryset(self):
        return DebtPayment.objects.filter(debt__user=self.request.user)
