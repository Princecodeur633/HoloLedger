"""Move every existing user's data into their own "Personnel" space.

Runs once, when spaces are introduced. Nothing is deleted: each row simply gets the
personal space of the user it already belonged to.
"""

from django.db import migrations

SCOPED_MODELS = [
    ("categories", "Category"),
    ("accounts", "Account"),
    ("accounts", "Transfer"),
    ("transactions", "Transaction"),
    ("budgets", "Budget"),
    ("goals", "Goal"),
    ("recurring", "RecurringRule"),
    ("debts", "Debt"),
]


def assign(apps, schema_editor):
    User = apps.get_model("users", "User")
    Space = apps.get_model("spaces", "Space")
    Membership = apps.get_model("spaces", "Membership")

    for user in User.objects.all():
        space = Space.objects.filter(kind="personal", memberships__user=user).first()
        if space is None:
            space = Space.objects.create(
                kind="personal",
                name="Personnel",
                icon="👤",
                currency=user.currency,
                created_by=user,
            )
            Membership.objects.create(space=space, user=user, role="owner")
        for app_label, model_name in SCOPED_MODELS:
            apps.get_model(app_label, model_name).objects.filter(
                user=user, space__isnull=True
            ).update(space=space)


class Migration(migrations.Migration):
    dependencies = [
        ("spaces", "0001_initial"),
        ("users", "0003_user_failed_logins_user_login_locked_until"),
        ("categories", "0003_category_space"),
        ("accounts", "0002_account_space_transfer_space"),
        ("transactions", "0006_transaction_space"),
        ("budgets", "0002_budget_space"),
        ("goals", "0002_goal_space"),
        ("recurring", "0003_recurringrule_space"),
        ("debts", "0002_debt_space"),
    ]

    operations = [migrations.RunPython(assign, migrations.RunPython.noop)]
