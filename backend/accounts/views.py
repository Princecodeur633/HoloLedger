from django.db import transaction as db_transaction
from django.db.models import ProtectedError
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response

from categories.models import Category
from transactions.models import Transaction

from .balances import account_balances
from .models import Account, Transfer
from .serializers import AccountSerializer, TransferSerializer

FEE_CATEGORY = {"name": "Frais", "type": "expense", "color": "#94a3b8", "icon": "receipt"}


class AccountViewSet(viewsets.ModelViewSet):
    serializer_class = AccountSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Account.objects.filter(user=self.request.user)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action == "list":
            context["balances"] = account_balances(self.request.user)
        return context

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "detail": "Ce compte contient des opérations : archivez-le plutôt que de le supprimer."
                },
                status=status.HTTP_409_CONFLICT,
            )


class TransferViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = TransferSerializer
    filterset_fields = ["from_account", "to_account"]

    def get_queryset(self):
        return Transfer.objects.filter(user=self.request.user).select_related(
            "from_account", "to_account"
        )

    @db_transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        transfer = serializer.save(user=user)
        if transfer.fee > 0:
            category, _ = Category.objects.get_or_create(
                user=user, name=FEE_CATEGORY["name"], type=FEE_CATEGORY["type"], defaults=FEE_CATEGORY
            )
            transfer.fee_transaction = Transaction.objects.create(
                user=user,
                type=Transaction.Type.EXPENSE,
                amount=transfer.fee,
                currency=user.currency,
                date=transfer.date,
                description=f"Frais de transfert {transfer.from_account} → {transfer.to_account}",
                category=category,
                account=transfer.from_account,
                payment_method=Transaction.PaymentMethod.OTHER,
            )
            transfer.save(update_fields=["fee_transaction"])

    @db_transaction.atomic
    def perform_destroy(self, instance):
        fee = instance.fee_transaction
        instance.delete()
        if fee:
            fee.delete()
