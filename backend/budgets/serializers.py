from rest_framework import serializers

from categories.models import Category
from categories.serializers import CategorySerializer

from .models import Budget


class BudgetSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.none())
    category_detail = CategorySerializer(source="category", read_only=True)
    usage = serializers.SerializerMethodField()

    class Meta:
        model = Budget
        fields = [
            "id",
            "category",
            "category_detail",
            "amount",
            "alert_threshold",
            "usage",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["category"].queryset = Category.objects.filter(
                user=request.user, type__in=[Category.Type.EXPENSE, Category.Type.BOTH]
            )

    def validate_alert_threshold(self, value):
        if not 1 <= value <= 100:
            raise serializers.ValidationError("Le seuil doit être compris entre 1 et 100 %.")
        return value

    def validate_category(self, category):
        duplicates = Budget.objects.filter(user=self.context["request"].user, category=category)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError("Un budget existe déjà pour cette catégorie.")
        return category

    def get_usage(self, budget):
        # Filled in bulk by the view (one query for all budgets).
        return self.context.get("usage", {}).get(budget.id)
