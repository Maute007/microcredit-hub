from decimal import Decimal

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0019_upgrade_institutional_contract_clauses_v2"),
    ]

    operations = [
        migrations.AddField(
            model_name="systemsettings",
            name="bom_province",
            field=models.CharField(blank=True, max_length=100, verbose_name="Província (relatório BdM)"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="bom_phone",
            field=models.CharField(blank=True, max_length=50, verbose_name="Telefone (relatório BdM)"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="bom_fax",
            field=models.CharField(blank=True, max_length=50, verbose_name="Fax (relatório BdM)"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="bom_email",
            field=models.EmailField(blank=True, max_length=254, verbose_name="E-mail da instituição (relatório BdM)"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="bom_num_workers",
            field=models.PositiveIntegerField(default=1, verbose_name="Nº de Trabalhadores"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="bom_start_date",
            field=models.CharField(blank=True, help_text="Ex.: Dezembro de 2024", max_length=100, verbose_name="Data de Início das Actividades"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="bom_operator_name",
            field=models.CharField(blank=True, max_length=200, verbose_name="Nome do Operador"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="bom_initial_capital",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=16, verbose_name="Capital Inicial (MZN)"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="bom_current_capital",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=16, verbose_name="Capital Actual (MZN)"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="bom_own_capital",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=16, verbose_name="Capitais Próprios (MZN)"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="bom_foreign_capital_national",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=16, verbose_name="Capitais Alheios Nacionais (MZN)"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="bom_foreign_capital_foreign",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=16, verbose_name="Capitais Alheios Estrangeiros (MZN)"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="bom_financing_loans",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=16, verbose_name="Empréstimos obtidos no período (MZN)"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="bom_financing_donations",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=16, verbose_name="Donativos obtidos no período (MZN)"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="bom_financing_capital_increase",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=16, verbose_name="Aumento do capital com recursos próprios (MZN)"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="bom_financial_situation",
            field=models.JSONField(blank=True, default=list, help_text="Lista de 3 objectos: [{caixa, bancos, outros_activos}, ...]", verbose_name="Situação Financeira (3 meses)"),
        ),
    ]
