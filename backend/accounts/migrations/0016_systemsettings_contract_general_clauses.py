from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0015_systemsettings_contract_logo"),
    ]

    operations = [
        migrations.AddField(
            model_name="systemsettings",
            name="contract_general_clauses",
            field=models.TextField(
                blank=True,
                help_text=(
                    "Texto legal fixo da instituição para a secção “Condições gerais e obrigações” da folha de contrato. "
                    "Isto é o contrato/modelo institucional. Os “Termos e condições” da categoria vêm do tipo de empréstimo e são anexados à parte."
                ),
                verbose_name="Cláusulas gerais do contrato (secção 03)",
            ),
        ),
    ]
