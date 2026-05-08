from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0010_systemsettings_banner_kicker_image_and_calendar_labels"),
    ]

    operations = [
        migrations.AddField(
            model_name="systemsettings",
            name="loan_default_interest_rate",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0.00"),
                help_text="Usada quando a categoria não define taxa padrão. Percentagem (ex.: 5 = 5%).",
                max_digits=5,
                verbose_name="Taxa de juro padrão (empréstimos) (%)",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="loan_allowed_terms_days",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Lista de prazos em dias (ex.: 30, 60, 90, 120). Vazio = sem restrição.",
                verbose_name="Prazos permitidos (dias)",
            ),
        ),
    ]

