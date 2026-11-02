from rest_framework import serializers

from .models import Account, Transfer


class AccountSerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = [
            "id",
            "name",
            "type",
            "initial_balance",
            "balance",
            "color",
            "icon",
            "is_archived",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_name(self, value):
        duplicates = Account.objects.filter(space=self.context["space"], name__iexact=value)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError("Un compte avec ce nom existe déjà.")
        return value

    def get_balance(self, account):
        # Computed in bulk by the view; recomputed on the fly otherwise.
        balances = self.context.get("balances")
        if balances is None:
            from .balances import account_balances

            balances = account_balances(account.space)
        return str(balances.get(account.id, account.initial_balance))


class TransferSerializer(serializers.ModelSerializer):
    from_account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.none())
    to_account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.none())
    from_account_name = serializers.CharField(source="from_account.name", read_only=True)
    to_account_name = serializers.CharField(source="to_account.name", read_only=True)
    # Filled for transfers between two spaces ("Perso → Couple").
    from_space = serializers.SerializerMethodField()
    to_space = serializers.SerializerMethodField()

    class Meta:
        model = Transfer
        fields = [
            "id",
            "from_account",
            "from_account_name",
            "to_account",
            "to_account_name",
            "from_space",
            "to_space",
            "amount",
            "fee",
            "fee_transaction",
            "date",
            "note",
            "created_at",
        ]
        read_only_fields = ["id", "fee_transaction", "created_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        space = self.context.get("space")
        if request and request.user.is_authenticated and space is not None:
            # Money leaves an account of the current space and may land in any of the
            # person's spaces (personal → couple, business → personal…).
            self.fields["from_account"].queryset = Account.objects.filter(space=space)
            self.fields["to_account"].queryset = Account.objects.filter(
                space__memberships__user=request.user
            )

    def _space(self, transfer, side):
        account = getattr(transfer, side)
        if account.space_id == transfer.space_id and transfer.from_account.space_id == transfer.to_account.space_id:
            return None
        return {"id": str(account.space_id), "name": account.space.name, "icon": account.space.icon}

    def get_from_space(self, transfer):
        return self._space(transfer, "from_account")

    def get_to_space(self, transfer):
        return self._space(transfer, "to_account")

    def validate(self, attrs):
        source, target = attrs["from_account"], attrs["to_account"]
        if source == target:
            raise serializers.ValidationError(
                {"to_account": "Choisissez deux comptes différents."}
            )
        if source.space.currency != target.space.currency:
            raise serializers.ValidationError(
                {"to_account": "Ces deux espaces n’utilisent pas la même devise."}
            )
        return attrs
