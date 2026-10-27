from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from transactions.serializers import TransactionSerializer

from .models import RecurringRule
from .serializers import ConfirmSerializer, RecurringRuleSerializer
from .services import create_occurrence, pending_occurrences, process_due_rules


class RecurringRuleViewSet(viewsets.ModelViewSet):
    serializer_class = RecurringRuleSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return RecurringRule.objects.filter(user=self.request.user).select_related(
            "category", "account"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False)
    def pending(self, request):
        """Create due auto-confirmed occurrences, then list those awaiting confirmation."""
        created = process_due_rules(user=request.user)
        rules = pending_occurrences(request.user)
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
