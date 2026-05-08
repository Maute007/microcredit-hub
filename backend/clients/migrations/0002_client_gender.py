from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("clients", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="client",
            name="gender",
            field=models.CharField(
                blank=True,
                choices=[("M", "Homem"), ("F", "Mulher"), ("O", "Outro")],
                default="",
                max_length=1,
                verbose_name="Género",
            ),
        ),
        migrations.AddField(
            model_name="historicalclient",
            name="gender",
            field=models.CharField(
                blank=True,
                choices=[("M", "Homem"), ("F", "Mulher"), ("O", "Outro")],
                default="",
                max_length=1,
                verbose_name="Género",
            ),
        ),
    ]
