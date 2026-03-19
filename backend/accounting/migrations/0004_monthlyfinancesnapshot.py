from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0003_companyfinancesettings"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MonthlyFinanceSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("month", models.CharField(max_length=7, unique=True, verbose_name="Mês (YYYY-MM)")),
                ("date_from", models.DateField(verbose_name="Data inicial do período")),
                ("date_to", models.DateField(verbose_name="Data final do período")),
                ("opening_balance", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("total_entries", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("total_exits", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("real_balance", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("consolidated_balance", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="monthly_finance_snapshots",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Fecho mensal financeiro",
                "verbose_name_plural": "Fechos mensais financeiros",
                "ordering": ["-month"],
            },
        ),
        migrations.AddIndex(
            model_name="monthlyfinancesnapshot",
            index=models.Index(fields=["month"], name="accounting_m_month_3e3de7_idx"),
        ),
    ]
