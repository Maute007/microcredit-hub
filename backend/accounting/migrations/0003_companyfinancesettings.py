from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0002_historicaltransaction_tax_amount_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="CompanyFinanceSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "opening_balance",
                    models.DecimalField(
                        decimal_places=2,
                        default=0,
                        help_text="Caixa/base inicial para cálculo do saldo real consolidado.",
                        max_digits=14,
                        verbose_name="Saldo inicial da empresa",
                    ),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Configuração financeira",
                "verbose_name_plural": "Configurações financeiras",
            },
        ),
    ]
