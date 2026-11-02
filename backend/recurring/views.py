from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from spaces.scoping import SpaceScopedMixin
from transactions.serializers import TransactionSerializer

from .models import RecurringRule
from .serializers import ConfirmSerializer, RecurringRuleSerializer
from .services import create_occurrence, pending_occurrences, process_due_rules


class RecurringRuleViewSet(SpaceScopedMixin, viewsets.ModelViewSet):
    serializer_class = RecurringRuleSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return RecurringRule.objects.filter(space=self.get_space()).select_related(
            "category", "account"
        )

    @action(detail=False)
    def pending(self, request):
        """Create due auto-confirmed occurrences, then list those awaiting confirmation."""
        created = process_due_rules(space=self.get_space())
        rules = pending_occurrences(self.get_space())
        return Response(
            {
                "created_count": len(created),
                "pending": RecurringRuleSerializer(
                    rules, many=True, context=self.get_serializer_context()
                ).data,
            }
        )

    def _due_rule(self):
        rule = self.get_object()
        if not rule.next_date:
            return rule, Response(
                {"detail": "Cette opération récurrente est terminée."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return rule, None

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        """Create the next occurrence (optionally with the real amount)."""
        rule, error = self._due_rule()
        if error:
            return error
        serializer = ConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tx = create_occurrence(rule, rule.next_date, serializer.validated_data.get("amount"))
        return Response(
            TransactionSerializer(tx, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def skip(self, request, pk=None):
        """Skip the next occurrence without creating anything."""
        rule, error = self._due_rule()
        if error:
            return error
        rule.advance()
        rule.save(update_fields=["next_date"])
        return Response(self.get_serializer(rule).data)
