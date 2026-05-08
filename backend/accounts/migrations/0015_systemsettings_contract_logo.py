from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0014_systemsettings_contract_page_bg_color"),
    ]

    operations = [
        migrations.AddField(
            model_name="systemsettings",
            name="contract_logo",
            field=models.ImageField(
                blank=True,
                help_text="Opcional: imagem carregada no servidor (tem prioridade sobre a URL).",
                null=True,
                upload_to="contract_logos/",
                verbose_name="Logo do contrato (ficheiro)",
            ),
        ),
    ]
