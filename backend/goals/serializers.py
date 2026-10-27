from decimal import Decimal

from rest_framework import serializers

from .models import Goal, GoalContribution


class GoalContributionSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoalContribution
        fields = ["id", "amount", "date", "note", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_amount(self, value):
        if value == 0:
            raise serializers.ValidationError("Le montant ne peut pas être nul.")
        return value


class GoalSerializer(serializers.ModelSerializer):
    saved_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True, default=Decimal("0")
    )
    remaining = serializers.SerializerMethodField()
    percent = serializers.SerializerMethodField()
    reached = serializers.SerializerMethodField()

    class Meta:
        model = Goal
        fields = [
            "id",
            "name",
            "target_amount",
            "saved_amount",
            "remaining",
            "percent",
            "reached",
            "deadline",
            "color",
            "icon",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def _saved(self, goal):
        return getattr(goal, "saved_amount", None) or Decimal("0")

    def get_remaining(self, goal):
        return str(max(goal.target_amount - self._saved(goal), Decimal("0")))

    def get_percent(self, goal):
        return min(round(float(self._saved(goal) / goal.target_amount * 100), 1), 100.0)

    def get_reached(self, goal):
        return self._saved(goal) >= goal.target_amount
