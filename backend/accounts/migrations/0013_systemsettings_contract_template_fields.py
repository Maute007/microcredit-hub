from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0012_systemsettings_creditor_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="systemsettings",
            name="contract_theme_color",
            field=models.CharField(
                blank=True,
                help_text="Hex/CSS. Vazio = usa cor primária.",
                max_length=20,
                verbose_name="Cor do contrato (tema)",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="contract_logo_url",
            field=models.URLField(
                blank=True,
                help_text="Logo exibido na folha do contrato. Vazio = usa o logo do sistema.",
                max_length=600,
                verbose_name="Logo do contrato (URL)",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="contract_header_title",
            field=models.CharField(
                blank=True,
                help_text="Ex.: MicroCrédito Solidário",
                max_length=120,
                verbose_name="Título do cabeçalho do contrato",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="contract_header_subtitle",
            field=models.CharField(
                blank=True,
                help_text="Ex.: Instituição de crédito comunitário • Moçambique",
                max_length=200,
                verbose_name="Subtítulo do cabeçalho do contrato",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="contract_doc_badge",
            field=models.CharField(
                blank=True,
                help_text="Ex.: Documento oficial",
                max_length=120,
                verbose_name="Selo do documento",
            ),
        ),
    ]

