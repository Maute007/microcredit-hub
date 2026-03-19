from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0004_monthlyfinancesnapshot"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MonthlySnapshotActionLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("snapshot_month", models.CharField(max_length=7, verbose_name="Mês (YYYY-MM)")),
                ("action", models.CharField(choices=[("reopen", "Reabertura")], max_length=20, verbose_name="Ação")),
                ("reason", models.CharField(blank=True, max_length=255, verbose_name="Motivo")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="monthly_snapshot_actions",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Utilizador",
                    ),
                ),
            ],
            options={
                "verbose_name": "Auditoria de fecho mensal",
                "verbose_name_plural": "Auditoria de fechos mensais",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="monthlysnapshotactionlog",
            index=models.Index(fields=["snapshot_month"], name="accounting_m_snapsho_84b66e_idx"),
        ),
        migrations.AddIndex(
            model_name="monthlysnapshotactionlog",
            index=models.Index(fields=["action"], name="accounting_m_action_8c6e6b_idx"),
        ),
    ]

