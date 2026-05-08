from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("loans", "0011_loancontractproof"),
    ]

    operations = [
        migrations.AddField(
            model_name="loan",
            name="sector",
            field=models.CharField(
                blank=True,
                choices=[
                    ("comercio", "Comércio"),
                    ("agricultura", "Agricultura"),
                    ("pecuaria", "Pecuária"),
                    ("industria", "Indústria"),
                    ("servicos", "Serviços"),
                    ("consumo", "Consumo"),
                    ("outros", "Outros"),
                ],
                default="outros",
                max_length=20,
                verbose_name="Sector de Actividade",
            ),
        ),
        migrations.AddField(
            model_name="historicalloan",
            name="sector",
            field=models.CharField(
                blank=True,
                choices=[
                    ("comercio", "Comércio"),
                    ("agricultura", "Agricultura"),
                    ("pecuaria", "Pecuária"),
                    ("industria", "Indústria"),
                    ("servicos", "Serviços"),
                    ("consumo", "Consumo"),
                    ("outros", "Outros"),
                ],
                default="outros",
                max_length=20,
                verbose_name="Sector de Actividade",
            ),
        ),
    ]
