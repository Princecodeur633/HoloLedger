"""Account balances: initial balance + incomes − expenses + transfers in − transfers out."""

from collections import defaultdict
from decimal import Decimal

from django.db.models import Q, Sum

from transactions.models import Transaction

from .models import Transfer


def account_balances(space, until=None):
    """Return {account_id: balance} for the space's accounts, optionally as of `until`.

    Transfers may come from / go to another space of the same person: only the side that
    belongs to this space is counted here.
    """
    balances = defaultdict(Decimal)
    for account in space.accounts.all():
        balances[account.id] = account.initial_balance
    own = set(balances)

    transactions = Transaction.objects.filter(space=space)
    transfers = Transfer.objects.filter(Q(from_account__space=space) | Q(to_account__space=space))
    if until is not None:
        transactions = transactions.filter(date__lte=until)
        transfers = transfers.filter(date__lte=until)

    for row in transactions.values("account", "type").annotate(total=Sum("amount")):
        sign = 1 if row["type"] == Transaction.Type.INCOME else -1
        balances[row["account"]] += sign * row["total"]
    for row in transfers.values("from_account").annotate(total=Sum("amount")):
        if row["from_account"] in own:
            balances[row["from_account"]] -= row["total"]
    for row in transfers.values("to_account").annotate(total=Sum("amount")):
        if row["to_account"] in own:
            balances[row["to_account"]] += row["total"]

    return dict(balances)


def total_balance(space, until=None):
    return sum(account_balances(space, until).values(), Decimal("0"))
