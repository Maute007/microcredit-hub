from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0011_systemsettings_loan_interest_and_terms"),
    ]

    operations = [
        migrations.AddField(
            model_name="systemsettings",
            name="creditor_legal_name",
            field=models.CharField(
                blank=True,
                help_text="Ex.: Kuchukuro Microcrédito E.I (Eurocrédito). Se vazio, usa o nome do sistema.",
                max_length=200,
                verbose_name="Nome legal do credor",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="creditor_address",
            field=models.CharField(
                blank=True,
                help_text="Ex.: Av. 25 de Setembro..., Prédio..., Cidade...",
                max_length=300,
                verbose_name="Morada/sede do credor",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="creditor_city",
            field=models.CharField(
                blank=True,
                help_text="Ex.: Maputo",
                max_length=120,
                verbose_name="Cidade do credor",
            ),
        ),
    ]

