import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("loans", "0010_loancategory_terms_and_validation_fields"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="LoanContractProof",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("contract_sha256", models.CharField(db_index=True, max_length=64, verbose_name="SHA256 do contrato")),
                ("signature_sha256", models.CharField(blank=True, max_length=64, verbose_name="SHA256 da assinatura")),
                ("rubrica_sha256", models.CharField(blank=True, max_length=64, verbose_name="SHA256 da rubrica")),
                ("server_hmac_sha256", models.CharField(db_index=True, max_length=64, verbose_name="HMAC do servidor (SHA256)")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_contract_proofs", to=settings.AUTH_USER_MODEL, verbose_name="Criado por")),
                ("loan", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="contract_proofs", to="loans.loan", verbose_name="Empréstimo")),
            ],
            options={
                "verbose_name": "Prova de contrato",
                "verbose_name_plural": "Provas de contrato",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="loancontractproof",
            index=models.Index(fields=["loan", "created_at"], name="loans_loanc_loan_id_7a2b0c_idx"),
        ),
        migrations.AddIndex(
            model_name="loancontractproof",
            index=models.Index(fields=["contract_sha256"], name="loans_loanc_contract_3a2d1a_idx"),
        ),
    ]

