from rest_framework import serializers

from accounts.balances import total_balance
from users.phone import InvalidPhone, normalize_phone

from .models import Invitation, Space


class SpaceSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    accounts = serializers.SerializerMethodField()
    pending_invitations = serializers.SerializerMethodField()

    class Meta:
        model = Space
        fields = [
            "id",
            "kind",
            "name",
            "icon",
            "currency",
            "role",
            "members",
            "balance",
            "accounts",
            "pending_invitations",
            "created_at",
        ]
        # Members are managed by invitations; the kind of a space never changes.
        read_only_fields = ["id", "kind", "created_at"]

    def _membership(self, space):
        user = self.context["request"].user
        return next((m for m in space.memberships.all() if m.user_id == user.id), None)

    def get_role(self, space):
        membership = self._membership(space)
        return membership.role if membership else None

    def get_members(self, space):
        return [
            {"id": str(m.user_id), "username": m.user.username, "role": m.role}
            for m in space.memberships.all()
        ]

    def get_balance(self, space):
        # Each space keeps its own total: nothing is added up across spaces.
        if space.is_group:
            from groups.schedule import build_board

            return str(build_board(space)["totals"]["cash"])  # the group's fund
        return str(total_balance(space))

    def get_accounts(self, space):
        return [
            {"id": str(a.id), "name": a.name}
            for a in space.accounts.all()
            if not a.is_archived
        ]

    def get_pending_invitations(self, space):
        return [
            {"id": str(i.id), "phone": i.phone, "created_at": i.created_at}
            for i in space.invitations.all()
            if i.status == Invitation.Status.PENDING
        ]


class SpaceCreateSerializer(serializers.ModelSerializer):
    kind = serializers.ChoiceField(
        choices=[Space.Kind.COUPLE, Space.Kind.BUSINESS, Space.Kind.TONTINE, Space.Kind.FAMILY]
    )
    name = serializers.CharField(max_length=60, required=False, allow_blank=True)

    class Meta:
        model = Space
        fields = ["kind", "name", "icon", "currency"]


class InviteSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=30)
    phone_country = serializers.CharField(max_length=2, required=False, allow_blank=True)

    def validate(self, attrs):
        try:
            attrs["phone"] = normalize_phone(attrs["phone"], attrs.get("phone_country") or None)
        except InvalidPhone:
            raise serializers.ValidationError({"phone": "Numéro de téléphone invalide."}) from None
        return attrs


class InvitationSerializer(serializers.ModelSerializer):
    space = serializers.SerializerMethodField()
    inviter = serializers.CharField(source="inviter.username", read_only=True)

    class Meta:
        model = Invitation
        fields = ["id", "space", "inviter", "phone", "status", "created_at"]

    def get_space(self, invitation):
        space = invitation.space
        return {"id": str(space.id), "kind": space.kind, "name": space.name, "icon": space.icon}
