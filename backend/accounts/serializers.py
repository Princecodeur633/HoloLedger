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
        duplicates = Account.objects.filter(user=self.context["request"].user, name__iexact=value)
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

            balances = account_balances(account.user)
        return str(balances.get(account.id, account.initial_balance))


class TransferSerializer(serializers.ModelSerializer):
    from_account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.none())
    to_account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.none())
    from_account_name = serializers.CharField(source="from_account.name", read_only=True)
    to_account_name = serializers.CharField(source="to_account.name", read_only=True)

    class Meta:
        model = Transfer
        fields = [
            "id",
            "from_account",
            "from_account_name",
            "to_account",
            "to_account_name",
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
        if request and request.user.is_authenticated:
            accounts = Account.objects.filter(user=request.user)
            self.fields["from_account"].queryset = accounts
            self.fields["to_account"].queryset = accounts

    def validate(self, attrs):
        if attrs["from_account"] == attrs["to_account"]:
            raise serializers.ValidationError(
                {"to_account": "Choisissez deux comptes différents."}
            )
        return attrs
