import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("transactions", "0004_assign_default_account"),
    ]

    operations = [
        migrations.AlterField(
            model_name="transaction",
            name="account",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="transactions",
                to="accounts.account",
            ),
        ),
    ]
