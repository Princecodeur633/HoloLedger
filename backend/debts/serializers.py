from decimal import Decimal

from rest_framework import serializers

from .models import Debt, DebtPayment


class DebtPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DebtPayment
        fields = ["id", "amount", "date", "created_at"]
        read_only_fields = ["id", "created_at"]


class DebtSerializer(serializers.ModelSerializer):
    repaid = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True, default=Decimal("0")
    )
    remaining = serializers.SerializerMethodField()
    percent = serializers.SerializerMethodField()
    settled = serializers.SerializerMethodField()
    payments = DebtPaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Debt
        fields = [
            "id",
            "direction",
            "person",
            "amount",
            "description",
            "date",
            "due_date",
            "repaid",
            "remaining",
            "percent",
            "settled",
            "payments",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def _repaid(self, debt):
        return getattr(debt, "repaid", None) or Decimal("0")

    def get_remaining(self, debt):
        return str(max(debt.amount - self._repaid(debt), Decimal("0")))

    def get_percent(self, debt):
        return min(round(float(self._repaid(debt) / debt.amount * 100), 1), 100.0)

    def get_settled(self, debt):
        return self._repaid(debt) >= debt.amount
