from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0016_systemsettings_contract_general_clauses"),
    ]

    operations = [
        migrations.AddField(
            model_name="systemsettings",
            name="contract_include_clauses_on_sheet",
            field=models.BooleanField(
                default=True,
                verbose_name="Incluir cláusulas institucionais na folha",
                help_text=(
                    "Quando desactivo, a folha (secção 03) não mostra o bloco de cláusulas gerais da instituição "
                    "(nem a lista breve por omissão). Os termos da categoria do empréstimo mantêm-se se existirem."
                ),
            ),
        ),
    ]
