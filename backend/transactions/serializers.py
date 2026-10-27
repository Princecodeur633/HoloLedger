from rest_framework import serializers

from accounts.models import Account, default_account
from categories.models import Category
from categories.serializers import CategorySerializer

from .models import Transaction


class TransactionSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.none())
    category_detail = CategorySerializer(source="category", read_only=True)
    account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.none(), required=False)
    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = Transaction
        fields = [
            "id",
            "type",
            "amount",
            "currency",
            "date",
            "description",
            "category",
            "category_detail",
            "account",
            "account_name",
            "recurring_rule",
            "source",
            "payment_method",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "recurring_rule", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["category"].queryset = Category.objects.filter(user=request.user)
            self.fields["account"].queryset = Account.objects.filter(user=request.user)

    def validate(self, attrs):
        type_ = attrs.get("type", getattr(self.instance, "type", None))
        category = attrs.get("category", getattr(self.instance, "category", None))
        if category and type_ and not category.accepts(type_):
            raise serializers.ValidationError(
                {"category": "Cette catégorie ne correspond pas au type d'opération."}
            )
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data.setdefault("currency", user.currency)
        validated_data.setdefault("account", default_account(user))
        return super().create(validated_data)
