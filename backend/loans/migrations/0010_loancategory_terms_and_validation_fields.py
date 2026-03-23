# Terms & conditions on category + field help text updates

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("loans", "0009_add_late_interest"),
    ]

    operations = [
        migrations.AddField(
            model_name="historicalloancategory",
            name="terms_and_conditions",
            field=models.TextField(
                blank=True,
                help_text="Texto legal ou comercial aplicável a esta categoria. Aparece no contrato quando um empréstimo usa esta categoria.",
                verbose_name="Termos e condições (T&C)",
            ),
        ),
        migrations.AddField(
            model_name="loancategory",
            name="terms_and_conditions",
            field=models.TextField(
                blank=True,
                help_text="Texto legal ou comercial aplicável a esta categoria. Aparece no contrato quando um empréstimo usa esta categoria.",
                verbose_name="Termos e condições (T&C)",
            ),
        ),
        migrations.AlterField(
            model_name="historicalloancategory",
            name="max_term_days",
            field=models.PositiveIntegerField(
                default=365,
                help_text="Maior prazo permitido; deve ser ≥ duração mínima.",
                verbose_name="Duração máxima do contrato (dias)",
            ),
        ),
        migrations.AlterField(
            model_name="historicalloancategory",
            name="min_term_days",
            field=models.PositiveIntegerField(
                default=30,
                help_text="Menor prazo permitido para o empréstimo, em dias.",
                verbose_name="Duração mínima do contrato (dias)",
            ),
        ),
        migrations.AlterField(
            model_name="loancategory",
            name="max_term_days",
            field=models.PositiveIntegerField(
                default=365,
                help_text="Maior prazo permitido; deve ser ≥ duração mínima.",
                verbose_name="Duração máxima do contrato (dias)",
            ),
        ),
        migrations.AlterField(
            model_name="loancategory",
            name="min_term_days",
            field=models.PositiveIntegerField(
                default=30,
                help_text="Menor prazo permitido para o empréstimo, em dias.",
                verbose_name="Duração mínima do contrato (dias)",
            ),
        ),
    ]
