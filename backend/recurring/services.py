from django.db import transaction as db_transaction
from django.utils import timezone

from transactions.models import Transaction

from .models import RecurringRule


def create_occurrence(rule, on_date, amount=None):
    """Create the transaction for `rule` on `on_date` and move the rule forward."""
    tx = Transaction.objects.create(
        user=rule.user,
        type=rule.type,
        amount=amount if amount is not None else rule.amount,
        currency=rule.user.currency,
        date=on_date,
        description=rule.description,
        category=rule.category,
        account=rule.account,
        payment_method=rule.payment_method,
        recurring_rule=rule,
    )
    rule.advance()
    rule.save(update_fields=["next_date"])
    return tx


def process_due_rules(user=None, today=None):
    """Create every due occurrence of auto-confirmed rules. Returns the created transactions."""
    today = today or timezone.localdate()
    rules = RecurringRule.objects.filter(
        is_active=True, auto_confirm=True, next_date__isnull=False, next_date__lte=today
    ).select_related("user", "category", "account")
    if user is not None:
        rules = rules.filter(user=user)

    created = []
    for rule in rules:
        with db_transaction.atomic():
            while rule.next_date and rule.next_date <= today:
                created.append(create_occurrence(rule, rule.next_date))
    return created


def pending_occurrences(user, today=None):
    """Due occurrences of rules that need a manual confirmation."""
    today = today or timezone.localdate()
    return RecurringRule.objects.filter(
        user=user, is_active=True, auto_confirm=False, next_date__isnull=False, next_date__lte=today
    ).select_related("category", "account")
