from rest_framework import serializers

from users.phone import InvalidPhone, normalize_phone

from .models import Contribution, GroupExpense, GroupMember, GroupRules


class RulesSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupRules
        fields = [
            "contribution_amount",
            "frequency",
            "start_date",
            "payment_delay_days",
            "late_penalty",
            "goal_name",
            "goal_amount",
        ]


class MemberSerializer(serializers.ModelSerializer):
    phone_country = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = GroupMember
        fields = ["id", "name", "phone", "phone_country", "expected_amount", "position", "is_active", "user"]
        read_only_fields = ["id", "user"]

    def validate(self, attrs):
        country = attrs.pop("phone_country", None) or None
        phone = attrs.get("phone")
        if phone:
            try:
                attrs["phone"] = normalize_phone(phone, country)
            except InvalidPhone:
                raise serializers.ValidationError({"phone": "Numéro de téléphone invalide."}) from None
        return attrs


class ContributionSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="member.name", read_only=True)
    declared_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    # Also note it as an expense in my personal space.
    record_in_personal = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = Contribution
        fields = [
            "id",
            "member",
            "member_name",
            "amount",
            "date",
            "reference",
            "note",
            "status",
            "declared_by_name",
            "reviewed_by_name",
            "reviewed_at",
            "refusal_reason",
            "record_in_personal",
            "created_at",
        ]
        read_only_fields = ["id", "status", "reviewed_at", "refusal_reason", "created_at"]

    def get_declared_by_name(self, c):
        return c.declared_by.username if c.declared_by else None

    def get_reviewed_by_name(self, c):
        return c.reviewed_by.username if c.reviewed_by else None


class ExpenseSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = GroupExpense
        fields = ["id", "amount", "purpose", "note", "date", "created_by_name", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_created_by_name(self, e):
        return e.created_by.username if e.created_by else None
