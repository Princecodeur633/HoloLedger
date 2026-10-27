from decimal import Decimal

from django.db.models import DecimalField, Sum, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Goal, GoalContribution
from .serializers import GoalContributionSerializer, GoalSerializer


class GoalViewSet(viewsets.ModelViewSet):
    serializer_class = GoalSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Goal.objects.filter(user=self.request.user).annotate(
            saved_amount=Coalesce(
                Sum("contributions__amount"),
                Value(Decimal("0"), output_field=DecimalField(max_digits=14, decimal_places=2)),
            )
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["get", "post"])
    def contributions(self, request, pk=None):
        goal = self.get_object()
        if request.method == "GET":
            return Response(GoalContributionSerializer(goal.contributions.all(), many=True).data)

        serializer = GoalContributionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(goal=goal)
        return Response(
            {"contribution": serializer.data, "goal": GoalSerializer(self.get_object()).data},
            status=status.HTTP_201_CREATED,
        )


class GoalContributionViewSet(mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Only deletion: contributions are created through /goals/{id}/contributions/."""

    serializer_class = GoalContributionSerializer

    def get_queryset(self):
        return GoalContribution.objects.filter(goal__user=self.request.user)
