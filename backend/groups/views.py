import random

from django.db import transaction as db_transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from spaces.models import Membership
from spaces.services import personal_space, request_space

from .models import Contribution, GroupExpense, GroupMember, Payout
from .schedule import build_board
from .serializers import ContributionSerializer, ExpenseSerializer, MemberSerializer, RulesSerializer


def group_space(request, manager=False):
    """Current space, which must be a tontine / family the user belongs to."""
    space = request_space(request)
    if not space.is_group:
        raise NotFound("Cet espace n’est ni une tontine ni une caisse familiale.")
    membership = space.memberships.get(user=request.user)
    if manager and not membership.is_manager:
        raise PermissionDenied("Réservé au gestionnaire du groupe.")
    return space, membership


def own_member(space, user):
    return space.group_members.filter(user=user).first()


def record_personal(user, kind, amount, date_, label):
    """Copy a contribution (expense) or a received pot (income) into the personal space."""
    from categories.models import Category
    from transactions.models import Transaction

    space = personal_space(user)
    name, color, icon = (
        ("Cotisations", "#a855f7", "users") if kind == "expense" else ("Tontine", "#22c55e", "coins")
    )
    category, _ = Category.objects.get_or_create(
        space=space,
        name=name,
        type=kind,
        defaults={"user": user, "color": color, "icon": icon},
    )
    Transaction.objects.create(
        user=user,
        space=space,
        type=kind,
        amount=amount,
        currency=space.currency,
        date=date_,
        description=label,
        category=category,
    )


class BoardView(APIView):
    """GET /api/group/ — the whole picture: rules, members' statuses, periods, totals."""

    def get(self, request):
        space, membership = group_space(request)
        board = build_board(space)
        me = own_member(space, request.user)
        roles = {str(m.user_id): m.role for m in space.memberships.all()}
        for row in board["members"]:
            row["role"] = roles.get(row["user"])
        return Response(
            {
                "kind": space.kind,
                "rules": RulesSerializer(board["rules"]).data,
                "members": board["members"],
                "periods": board["periods"],
                "current_period": board["current_period"],
                "totals": board["totals"],
                "me": {
                    "member": str(me.id) if me else None,
                    "is_manager": membership.is_manager,
                },
                "pending_count": space.contributions.filter(
                    status=Contribution.Status.PENDING
                ).count(),
            }
        )


class RulesView(APIView):
    def patch(self, request):
        space, _ = group_space(request, manager=True)
        rules = build_board(space)["rules"]
        serializer = RulesSerializer(rules, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MembersView(APIView):
    """POST: the manager adds a "carnet" member (someone without the app)."""

    def post(self, request):
        space, _ = group_space(request, manager=True)
        if space.group_members.filter(is_active=True).count() >= space.max_members:
            raise ValidationError({"detail": "Le groupe est complet (50 membres au maximum)."})
        serializer = MemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        last = space.group_members.aggregate(top=Max("position"))["top"] or 0
        member = serializer.save(space=space, position=last + 1)
        return Response(MemberSerializer(member).data, status=status.HTTP_201_CREATED)


class MemberDetailView(APIView):
    def get_member(self, request, pk):
        space, _ = group_space(request, manager=True)
        return space, get_object_or_404(GroupMember, pk=pk, space=space)

    def patch(self, request, pk):
        _, member = self.get_member(request, pk)
        serializer = MemberSerializer(member, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        _, member = self.get_member(request, pk)
        if member.user_id:
            raise ValidationError({"detail": "Ce membre a un compte : il doit quitter l’espace lui-même."})
        if member.contributions.exists():
            # Keep the history: the member just stops owing anything.
            member.is_active = False
            member.save(update_fields=["is_active"])
        else:
            member.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MemberRoleView(APIView):
    """POST {manager: true|false}: give / take back the manager role (app members only)."""

    def post(self, request, pk):
        space, _ = group_space(request, manager=True)
        member = get_object_or_404(GroupMember, pk=pk, space=space)
        membership = space.memberships.filter(user_id=member.user_id).first()
        if membership is None:
            raise ValidationError({"detail": "Seul un membre qui a l’app peut être gestionnaire."})
        if membership.role == Membership.Role.OWNER:
            raise ValidationError({"detail": "Le créateur reste gestionnaire."})
        membership.role = (
            Membership.Role.MANAGER if request.data.get("manager") else Membership.Role.MEMBER
        )
        membership.save(update_fields=["role"])
        return Response({"role": membership.role})


class ShuffleView(APIView):
    """Tontine: draw lots for the order in which members receive the pot."""

    @db_transaction.atomic
    def post(self, request):
        space, _ = group_space(request, manager=True)
        if space.payouts.exists():
            raise ValidationError({"detail": "Des cagnottes ont déjà été remises : l’ordre est figé."})
        members = list(space.group_members.filter(is_active=True))
        random.shuffle(members)
        for position, member in enumerate(members, start=1):
            member.position = position
            member.save(update_fields=["position"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ContributionsView(APIView):
    def get(self, request):
        space, _ = group_space(request)
        qs = space.contributions.select_related("member", "declared_by", "reviewed_by")
        if request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        if request.query_params.get("member"):
            qs = qs.filter(member_id=request.query_params["member"])
        return Response(ContributionSerializer(qs[:200], many=True).data)

    @db_transaction.atomic
    def post(self, request):
        """A member declares their own payment (to validate); a manager records any (validated)."""
        space, membership = group_space(request)
        serializer = ContributionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        member = data["member"]
        if member.space_id != space.id:
            raise ValidationError({"member": "Membre introuvable."})
        mine = member.user_id == request.user.id
        if not membership.is_manager and not mine:
            raise PermissionDenied("Vous ne pouvez déclarer que vos propres versements.")
        record = data.pop("record_in_personal", False)
        validated = membership.is_manager
        contribution = serializer.save(
            space=space,
            declared_by=request.user,
            status=Contribution.Status.VALIDATED if validated else Contribution.Status.PENDING,
            reviewed_by=request.user if validated else None,
            reviewed_at=timezone.now() if validated else None,
        )
        if record and mine:
            record_personal(
                request.user, "expense", contribution.amount, contribution.date, f"Cotisation {space.name}"
            )
        return Response(ContributionSerializer(contribution).data, status=status.HTTP_201_CREATED)


class ContributionReviewView(APIView):
    """POST …/validate/ or …/refuse/ {reason} — manager only."""

    def post(self, request, pk, decision):
        if decision not in ("validate", "refuse"):
            raise NotFound()
        space, _ = group_space(request, manager=True)
        contribution = get_object_or_404(Contribution, pk=pk, space=space)
        if contribution.status != Contribution.Status.PENDING:
            raise ValidationError({"detail": "Ce versement a déjà été traité."})
        if decision == "refuse":
            contribution.status = Contribution.Status.REFUSED
            contribution.refusal_reason = (request.data.get("reason") or "")[:255]
        else:
            contribution.status = Contribution.Status.VALIDATED
        contribution.reviewed_by = request.user
        contribution.reviewed_at = timezone.now()
        contribution.save()
        return Response(ContributionSerializer(contribution).data)


class ContributionDetailView(APIView):
    def delete(self, request, pk):
        space, membership = group_space(request)
        contribution = get_object_or_404(Contribution, pk=pk, space=space)
        own_pending = (
            contribution.declared_by_id == request.user.id
            and contribution.status == Contribution.Status.PENDING
        )
        if not (membership.is_manager or own_pending):
            raise PermissionDenied("Seul le gestionnaire peut supprimer ce versement.")
        contribution.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PayoutsView(APIView):
    """Tontine: hand the pot of a session to its beneficiary."""

    def post(self, request):
        space, _ = group_space(request, manager=True)
        if space.kind != space.Kind.TONTINE:
            raise NotFound()
        board = build_board(space)
        try:
            session = int(request.data.get("session"))
            period = board["periods"][session - 1]
        except (TypeError, ValueError, IndexError):
            raise ValidationError({"session": "Séance introuvable."}) from None
        if period["payout"] is not None:
            raise ValidationError({"session": "La cagnotte de cette séance a déjà été remise."})
        member = get_object_or_404(GroupMember, pk=period["beneficiary"]["id"], space=space)
        payout = Payout.objects.create(
            space=space,
            session=session,
            member=member,
            amount=request.data.get("amount") or period["collected"],
            created_by=request.user,
        )
        return Response({"id": str(payout.id), "amount": payout.amount}, status=status.HTTP_201_CREATED)


class PayoutDetailView(APIView):
    def delete(self, request, pk):
        space, _ = group_space(request, manager=True)
        get_object_or_404(Payout, pk=pk, space=space).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def post(self, request, pk):
        """The beneficiary copies the pot received as an income in their personal space."""
        space, _ = group_space(request)
        payout = get_object_or_404(Payout, pk=pk, space=space, member__user=request.user)
        if payout.recorded_in_personal:
            raise ValidationError({"detail": "Déjà ajouté à votre espace personnel."})
        record_personal(request.user, "income", payout.amount, payout.date, f"Cagnotte {space.name}")
        payout.recorded_in_personal = True
        payout.save(update_fields=["recorded_in_personal"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ExpensesView(APIView):
    """Family: what the common money was used for (everyone sees it, the manager records it)."""

    def get(self, request):
        space, _ = group_space(request)
        return Response(ExpenseSerializer(space.group_expenses.all()[:200], many=True).data)

    def post(self, request):
        space, _ = group_space(request, manager=True)
        serializer = ExpenseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = serializer.save(space=space, created_by=request.user)
        return Response(ExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)


class ExpenseDetailView(APIView):
    def delete(self, request, pk):
        space, _ = group_space(request, manager=True)
        get_object_or_404(GroupExpense, pk=pk, space=space).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
