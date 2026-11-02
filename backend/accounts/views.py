from django.db import transaction as db_transaction
from django.db.models import ProtectedError, Q
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response

from categories.models import Category
from spaces.scoping import SpaceScopedMixin
from transactions.models import Transaction

from .balances import account_balances
from .models import Account, Transfer
from .serializers import AccountSerializer, TransferSerializer

FEE_CATEGORY = {"name": "Frais", "type": "expense", "color": "#94a3b8", "icon": "receipt"}


class AccountViewSet(SpaceScopedMixin, viewsets.ModelViewSet):
    serializer_class = AccountSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Account.objects.filter(space=self.get_space())

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action == "list":
            context["balances"] = account_balances(self.get_space())
        return context

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
    SpaceScopedMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = TransferSerializer
    filterset_fields = ["from_account", "to_account"]

    def get_queryset(self):
        space = self.get_space()
        return (
            Transfer.objects.filter(Q(from_account__space=space) | Q(to_account__space=space))
            .select_related("from_account__space", "to_account__space")
            .distinct()
        )

    @db_transaction.atomic
    def perform_create(self, serializer):
        user, space = self.request.user, self.get_space()
        transfer = serializer.save(user=user, space=space)
        if transfer.fee > 0:
            category, _ = Category.objects.get_or_create(
                space=space,
                name=FEE_CATEGORY["name"],
                type=FEE_CATEGORY["type"],
                defaults={**FEE_CATEGORY, "user": user},
            )
            transfer.fee_transaction = Transaction.objects.create(
                user=user,
                space=space,
                type=Transaction.Type.EXPENSE,
                amount=transfer.fee,
                currency=space.currency,
                date=transfer.date,
                description=f"Frais de transfert {transfer.from_account} → {transfer.to_account}",
                category=category,
                account=transfer.from_account,
                payment_method=Transaction.PaymentMethod.OTHER,
            )
            transfer.save(update_fields=["fee_transaction"])

    def destroy(self, request, *args, **kwargs):
        # The receiving space sees the transfer but only the sending space may cancel it.
        if self.get_object().from_account.space_id != self.get_space().id:
            return Response(
                {"detail": "Annulez ce transfert depuis l’espace d’où l’argent est parti."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    @db_transaction.atomic
    def perform_destroy(self, instance):
        fee = instance.fee_transaction
        instance.delete()
        if fee:
            fee.delete()
