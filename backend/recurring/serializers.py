from decimal import Decimal

from rest_framework import serializers

from accounts.models import Account, default_account
from categories.models import Category
from categories.serializers import CategorySerializer
from transactions.models import Transaction

from .models import RecurringRule


class RecurringRuleSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.none())
    category_detail = CategorySerializer(source="category", read_only=True)
    account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.none(), required=False)
    account_name = serializers.CharField(source="account.name", read_only=True)
    payment_method = serializers.ChoiceField(
        choices=Transaction.PaymentMethod.choices, default=Transaction.PaymentMethod.CASH
    )

    class Meta:
        model = RecurringRule
        fields = [
            "id",
            "type",
            "amount",
            "category",
            "category_detail",
            "account",
            "account_name",
            "description",
            "payment_method",
            "frequency",
            "interval",
            "start_date",
            "end_date",
            "next_date",
            "auto_confirm",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "next_date", "created_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["category"].queryset = Category.objects.filter(user=request.user)
            self.fields["account"].queryset = Account.objects.filter(user=request.user)

    def validate_interval(self, value):
        if not 1 <= value <= 52:
            raise serializers.ValidationError("L'intervalle doit être compris entre 1 et 52.")
        return value

    def validate(self, attrs):
        get = lambda key: attrs.get(key, getattr(self.instance, key, None))  # noqa: E731
        category, type_ = get("category"), get("type")
        if category and type_ and not category.accepts(type_):
            raise serializers.ValidationError(
                {"category": "Cette catégorie ne correspond pas au type d'opération."}
            )
        start, end = get("start_date"), get("end_date")
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "La date de fin précède le début."})
        return attrs

    def create(self, validated_data):
        validated_data.setdefault("account", default_account(self.context["request"].user))
        validated_data["next_date"] = validated_data["start_date"]
        return super().create(validated_data)

    def update(self, instance, validated_data):
        rule = super().update(instance, validated_data)
        if {"start_date", "frequency", "interval", "end_date"} & validated_data.keys():
            # Recompute the schedule, resuming after the last occurrence already created.
            last = rule.transactions.order_by("-date").values_list("date", flat=True).first()
            next_date = rule.start_date
            while last and next_date <= last:
                next_date = rule.occurrence_after(next_date)
            rule.next_date = None if rule.end_date and next_date > rule.end_date else next_date
            rule.save(update_fields=["next_date"])
        return rule


class ConfirmSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01"), required=False
    )
