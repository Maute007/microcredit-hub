from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0013_systemsettings_contract_template_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="systemsettings",
            name="contract_page_bg_color",
            field=models.CharField(
                blank=True,
                help_text="Cor da página inteira ao imprimir. Vazio = branco.",
                max_length=20,
                verbose_name="Cor de fundo da folha (contrato)",
            ),
        ),
    ]

