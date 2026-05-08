from pathlib import Path

from django.db import migrations


def upgrade_clauses(apps, schema_editor):
    SystemSettings = apps.get_model("accounts", "SystemSettings")
    base = Path(__file__).resolve().parent.parent / "fixtures"
    v1_path = base / "default_institutional_contract_clauses_pt_v1_seeded.txt"
    new_path = base / "default_institutional_contract_clauses_pt.txt"
    if not new_path.is_file():
        return
    new_text = new_path.read_text(encoding="utf-8").strip()
    v1_text = v1_path.read_text(encoding="utf-8").strip() if v1_path.is_file() else ""

    for obj in SystemSettings.objects.all():
        cur = (obj.contract_general_clauses or "").strip()
        if not cur or (v1_text and cur == v1_text):
            obj.contract_general_clauses = new_text
            obj.save(update_fields=["contract_general_clauses"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0018_seed_default_institutional_contract_clauses"),
    ]

    operations = [
        migrations.RunPython(upgrade_clauses, noop_reverse),
    ]
