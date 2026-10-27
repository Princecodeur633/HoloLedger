"""Account balances: initial balance + incomes − expenses + transfers in − transfers out."""

from collections import defaultdict
from decimal import Decimal

from django.db.models import Sum

from transactions.models import Transaction

from .models import Transfer


def account_balances(user, until=None):
    """Return {account_id: balance}, optionally as of the end of day `until`."""
    balances = defaultdict(Decimal)
    for account in user.accounts.all():
        balances[account.id] = account.initial_balance

    transactions = Transaction.objects.filter(user=user)
    transfers = Transfer.objects.filter(user=user)
    if until is not None:
        transactions = transactions.filter(date__lte=until)
        transfers = transfers.filter(date__lte=until)

    for row in transactions.values("account", "type").annotate(total=Sum("amount")):
        sign = 1 if row["type"] == Transaction.Type.INCOME else -1
        balances[row["account"]] += sign * row["total"]
    for row in transfers.values("from_account").annotate(total=Sum("amount")):
        balances[row["from_account"]] -= row["total"]
    for row in transfers.values("to_account").annotate(total=Sum("amount")):
        balances[row["to_account"]] += row["total"]

    return dict(balances)


def total_balance(user, until=None):
    return sum(account_balances(user, until).values(), Decimal("0"))
