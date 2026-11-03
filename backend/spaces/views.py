from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction as db_transaction
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from users.whatsapp import digits

from .models import Invitation, Membership, Space
from .serializers import (
    InvitationSerializer,
    InviteSerializer,
    SpaceCreateSerializer,
    SpaceSerializer,
)
from .services import create_space, in_couple, join_group, user_spaces

User = get_user_model()

DEFAULT_NAMES = {
    Space.Kind.COUPLE: "Couple",
    Space.Kind.BUSINESS: "Business",
    Space.Kind.TONTINE: "Tontine",
    Space.Kind.FAMILY: "Famille",
}


def error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({"detail": message}, status=code)


def free_seats(space):
    pending = space.invitations.filter(status=Invitation.Status.PENDING).count()
    return space.max_members - space.memberships.count() - pending


class SpaceViewSet(viewsets.ModelViewSet):
    """The spaces the person belongs to (each with its own balance), and their settings."""

    serializer_class = SpaceSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return user_spaces(self.request.user).prefetch_related(
            "memberships__user", "accounts", "invitations"
        )

    def create(self, request, *args, **kwargs):
        payload = SpaceCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        kind = data["kind"]
        if kind == Space.Kind.COUPLE and in_couple(request.user):
            return error("Vous êtes déjà dans un espace couple.")
        space = create_space(
            request.user,
            kind,
            (data.get("name") or "").strip() or DEFAULT_NAMES[kind],
            currency=data.get("currency"),
            icon=data.get("icon", ""),
        )
        return Response(
            self.get_serializer(self.get_queryset().get(pk=space.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, *args, **kwargs):
        space = self.get_object()
        if space.kind == Space.Kind.PERSONAL:
            return error("L’espace personnel ne peut pas être supprimé.")
        if not space.memberships.filter(user=request.user, role=Membership.Role.OWNER).exists():
            return error("Seul le créateur peut supprimer cet espace.", status.HTTP_403_FORBIDDEN)
        space.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    @db_transaction.atomic
    def leave(self, request, pk=None):
        """Leave a shared space. It stays (with its history) for the other member."""
        space = self.get_object()
        if space.kind == Space.Kind.PERSONAL:
            return error("Vous ne pouvez pas quitter votre espace personnel.")
        space.memberships.filter(user=request.user).delete()
        # In a group the person's payments stay in the history, as a member without the app.
        space.group_members.filter(user=request.user).update(user=None)
        remaining = space.memberships.order_by("joined_at")
        if not remaining.exists():
            space.delete()
        elif not remaining.filter(role=Membership.Role.OWNER).exists():
            first = remaining.first()
            first.role = Membership.Role.OWNER
            first.save(update_fields=["role"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="remove-member")
    def remove_member(self, request, pk=None):
        """The creator removes the other member (who keeps nothing of the space)."""
        space = self.get_object()
        if not space.memberships.filter(user=request.user, role=Membership.Role.OWNER).exists():
            return error("Seul le créateur peut retirer un membre.", status.HTTP_403_FORBIDDEN)
        user_id = request.data.get("user")
        if str(user_id) == str(request.user.id):
            return error("Utilisez « Quitter l’espace ».")
        deleted, _ = space.memberships.filter(user_id=user_id).delete()
        space.group_members.filter(user_id=user_id).update(user=None)
        if not deleted:
            return error("Membre introuvable.", status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def invite(self, request, pk=None):
        """Invite a partner / associate by phone number (they may not have an account yet)."""
        space = self.get_object()
        if space.kind == Space.Kind.PERSONAL:
            return error("On ne peut pas inviter dans l’espace personnel.")
        payload = InviteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        phone = payload.validated_data["phone"]

        if phone == request.user.phone:
            return error("C’est votre propre numéro.")
        invitee = User.objects.filter(phone=phone).first()
        if invitee and space.memberships.filter(user=invitee).exists():
            return error("Cette personne fait déjà partie de l’espace.")
        if invitee and space.kind == Space.Kind.COUPLE and in_couple(invitee):
            return error("Cette personne est déjà dans un espace couple.")

        invitation = space.invitations.filter(phone=phone, status=Invitation.Status.PENDING).first()
        if invitation is None:
            if free_seats(space) <= 0:
                return error(
                    {
                        Space.Kind.BUSINESS: "Cet espace est complet (2 personnes au maximum).",
                        Space.Kind.COUPLE: "Un espace couple réunit 2 personnes.",
                    }.get(space.kind, "Le groupe est complet (50 membres au maximum).")
                )
            invitation = Invitation.objects.create(space=space, inviter=request.user, phone=phone)

        # Free and without any API: a wa.me link the inviter sends from their own WhatsApp.
        page = "/spaces" if invitee else "/register"
        message = (
            f"{request.user.username} vous invite à rejoindre l’espace « {space.name} » "
            f"sur HoloLedger : {settings.FRONTEND_URL.rstrip('/')}{page}"
        )
        return Response(
            {
                "invitation": InvitationSerializer(invitation).data,
                "registered": invitee is not None,
                "whatsapp_url": f"https://wa.me/{digits(phone)}?text={quote(message)}",
            },
            status=status.HTTP_201_CREATED,
        )


class InvitationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Invitations received (by phone number), plus cancelling the ones a space sent."""

    serializer_class = InvitationSerializer
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        if not user.phone:
            return Invitation.objects.none()
        return (
            Invitation.objects.filter(phone=user.phone, status=Invitation.Status.PENDING)
            .exclude(space__memberships__user=user)
            .select_related("space", "inviter")
        )

    def _respond(self, invitation, new_status):
        invitation.status = new_status
        invitation.responded_at = timezone.now()
        invitation.save(update_fields=["status", "responded_at"])

    @action(detail=True, methods=["post"])
    @db_transaction.atomic
    def accept(self, request, pk=None):
        invitation = self.get_object()
        space = invitation.space
        if space.kind == Space.Kind.COUPLE and in_couple(request.user):
            return error("Vous êtes déjà dans un espace couple : quittez-le d’abord.")
        if space.memberships.count() >= space.max_members:
            return error("Cet espace est déjà complet.")
        Membership.objects.create(space=space, user=request.user, role=Membership.Role.MEMBER)
        if space.is_group:
            join_group(space, request.user)
        self._respond(invitation, Invitation.Status.ACCEPTED)
        return Response(
            SpaceSerializer(
                user_spaces(request.user)
                .prefetch_related("memberships__user", "accounts", "invitations")
                .get(pk=space.pk),
                context={"request": request},
            ).data
        )

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        self._respond(self.get_object(), Invitation.Status.DECLINED)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """Called by a member of the inviting space (not via the received list)."""
        invitation = (
            Invitation.objects.filter(
                pk=pk,
                status=Invitation.Status.PENDING,
                space__memberships__user=request.user,
            )
            .first()
        )
        if invitation is None:
            return error("Invitation introuvable.", status.HTTP_404_NOT_FOUND)
        self._respond(invitation, Invitation.Status.CANCELLED)
        return Response(status=status.HTTP_204_NO_CONTENT)



class NotificationsView(APIView):
    """GET /api/notifications/ — what needs the person's attention, across all their spaces."""

    def get(self, request):
        from budgets.models import Budget
        from budgets.usage import OVER, budget_usage
        from groups.models import Contribution
        from groups.schedule import build_board
        from recurring.services import pending_occurrences

        user, today = request.user, timezone.localdate()
        items = []

        def add(space, text, href, tone="info"):
            items.append(
                {
                    "space": (
                        {"id": str(space.id), "name": space.name, "icon": space.icon, "kind": space.kind}
                        if space
                        else None
                    ),
                    "text": text,
                    "href": href,
                    "tone": tone,
                }
            )

        if user.phone:
            received = (
                Invitation.objects.filter(phone=user.phone, status=Invitation.Status.PENDING)
                .exclude(space__memberships__user=user)
                .count()
            )
            if received:
                add(None, f"{received} invitation{'s' if received > 1 else ''} à rejoindre un espace", "/spaces")

        for membership in Membership.objects.filter(user=user).select_related("space"):
            space = membership.space
            if space.is_group:
                if membership.is_manager:
                    pending = space.contributions.filter(status=Contribution.Status.PENDING).count()
                    if pending:
                        add(space, f"{pending} versement{'s' if pending > 1 else ''} à valider", "/group/payments", "warning")
                board = build_board(space, today)
                row = next((r for r in board["members"] if r["user"] == str(user.id)), None)
                period = board["current_period"]
                if row and row["late_count"]:
                    add(space, "Votre cotisation est en retard", "/group/pay", "danger")
                elif row and period:
                    index = next(
                        (i for i, p in enumerate(board["periods"]) if p["index"] == period["index"]),
                        None,
                    )
                    if index is not None and row["statuses"][index] == "due":
                        add(space, f"Cotisation à payer avant le {period['deadline']:%d/%m}", "/group/pay", "warning")
                continue

            recurring = pending_occurrences(space).count()
            if recurring:
                add(space, f"{recurring} opération{'s' if recurring > 1 else ''} récurrente{'s' if recurring > 1 else ''} à confirmer", "/recurring", "warning")
            budgets = Budget.objects.filter(space=space).select_related("category")
            over = [b for b in budgets if budget_usage([b], today)[b.id]["status"] == OVER]
            if over:
                add(space, f"Budget dépassé : {', '.join(b.category.name for b in over[:2])}", "/budgets", "danger")

        return Response({"count": len(items), "items": items})
