"""Give every existing user a default "Espèces" account and attach their transactions to it."""

from django.db import migrations


def assign_default_account(apps, schema_editor):
    User = apps.get_model("users", "User")
    Account = apps.get_model("accounts", "Account")
    Transaction = apps.get_model("transactions", "Transaction")

    for user in User.objects.all():
        account = Account.objects.filter(user=user, is_archived=False).order_by("created_at").first()
        if account is None:
            account = Account.objects.create(
                user=user, name="Espèces", type="cash", color="#22c55e", icon="wallet"
            )
        Transaction.objects.filter(user=user, account__isnull=True).update(account=account)


class Migration(migrations.Migration):
    dependencies = [
        ("transactions", "0003_transaction_account_transaction_recurring_rule"),
        ("accounts", "0001_initial"),
        ("users", "0001_initial"),
    ]

    operations = [migrations.RunPython(assign_default_account, migrations.RunPython.noop)]
