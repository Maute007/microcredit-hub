from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hr", "0006_hrsettings_auto_detect_late_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="payrolladjustment",
            name="date",
            field=models.DateField(
                null=True,
                blank=True,
                verbose_name="Data do lançamento",
            ),
        ),
        migrations.AlterUniqueTogether(
            name="payrolladjustment",
            unique_together=set(),
        ),
    ]

