"""Which space a request works on, and the rules for creating / joining spaces."""

from django.db import transaction as db_transaction
from rest_framework.exceptions import NotFound

from .models import Membership, Space


def personal_space(user):
    """The user's own space, created on the fly for accounts that predate spaces."""
    space = Space.objects.filter(kind=Space.Kind.PERSONAL, memberships__user=user).first()
    if space is None:
        space = create_space(user, Space.Kind.PERSONAL, "Personnel", currency=user.currency)
    return space


def user_spaces(user):
    return Space.objects.filter(memberships__user=user).order_by("created_at")


def request_space(request):
    """Space chosen by the app (`?space=<id>`, or the X-Space header); personal by default.

    A space the user is not a member of is reported as not found: the app never falls back
    silently to another space, so nothing gets written in the wrong place.
    """
    cached = getattr(request, "_holo_space", None)
    if cached is not None:
        return cached
    space_id = request.query_params.get("space") or request.headers.get("X-Space")
    if space_id:
        space = user_spaces(request.user).filter(pk=space_id).first() if _is_uuid(space_id) else None
        if space is None:
            raise NotFound("Espace introuvable ou inaccessible.")
    else:
        space = personal_space(request.user)
    request._holo_space = space
    return space


def _is_uuid(value):
    import uuid

    try:
        uuid.UUID(str(value))
        return True
    except ValueError:
        return False


def in_couple(user):
    return Membership.objects.filter(user=user, space__kind=Space.Kind.COUPLE).exists()


@db_transaction.atomic
def create_space(user, kind, name, currency=None, icon=""):
    space = Space.objects.create(
        kind=kind,
        name=name,
        icon=icon,
        currency=currency or user.currency,
        created_by=user,
    )
    Membership.objects.create(space=space, user=user, role=Membership.Role.OWNER)
    if space.is_group:
        from groups.models import GroupRules

        GroupRules.objects.create(space=space)
        join_group(space, user)
    else:
        # Default categories and account for this kind of space (see spaces/seed.py).
        from .seed import seed_space

        seed_space(space, user)
    return space


def join_group(space, user):
    """Make an app user a participant of a tontine / family.

    A "carnet" member created earlier with the same phone number is taken over, so the
    person finds the payments already recorded for them.
    """
    from django.db.models import Max

    from groups.models import GroupMember

    carnet = (
        space.group_members.filter(user__isnull=True, phone=user.phone).first()
        if user.phone
        else None
    )
    if carnet:
        carnet.user = user
        carnet.is_active = True
        carnet.save(update_fields=["user", "is_active"])
        return carnet
    last = space.group_members.aggregate(top=Max("position"))["top"] or 0
    return GroupMember.objects.create(
        space=space, user=user, name=user.username, phone=user.phone or "", position=last + 1
    )
