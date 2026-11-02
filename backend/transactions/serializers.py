from rest_framework import serializers

from accounts.models import Account, default_account
from categories.models import Category
from categories.serializers import CategorySerializer

from .models import Transaction


class TransactionSerializer(serializers.ModelSerializer):
    # Who recorded it: shown as "payé par" in shared spaces.
    author = serializers.SerializerMethodField()
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
            "author",
            "source",
            "payment_method",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "recurring_rule", "created_at", "updated_at"]

    def get_author(self, tx):
        return {"id": str(tx.user_id), "username": tx.user.username}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        space = self.context.get("space")
        if space is not None:
            self.fields["category"].queryset = Category.objects.filter(space=space)
            self.fields["account"].queryset = Account.objects.filter(space=space)

    def validate(self, attrs):
        type_ = attrs.get("type", getattr(self.instance, "type", None))
        category = attrs.get("category", getattr(self.instance, "category", None))
        if category and type_ and not category.accepts(type_):
            raise serializers.ValidationError(
                {"category": "Cette catégorie ne correspond pas au type d'opération."}
            )
        return attrs

    def create(self, validated_data):
        user, space = self.context["request"].user, self.context["space"]
        validated_data.setdefault("currency", space.currency)
        validated_data.setdefault("account", default_account(space, user))
        return super().create(validated_data)
