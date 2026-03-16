from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("loans", "0005_historicalloancategory_loancategory_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="loancategory",
            name="default_interest_rate",
            field=models.DecimalField(
                max_digits=5,
                decimal_places=2,
                default=Decimal("0.00"),
                verbose_name="Taxa de juro padrão (%)",
                help_text=(
                    "Taxa sugerida ao criar um novo empréstimo desta categoria "
                    "(não altera empréstimos já existentes)."
                ),
            ),
        ),
        migrations.AddField(
            model_name="loancategory",
            name="default_term_months",
            field=models.PositiveIntegerField(
                default=12,
                verbose_name="Prazo padrão (meses)",
                help_text="Número de meses sugerido ao criar um novo empréstimo desta categoria.",
            ),
        ),
    ]


