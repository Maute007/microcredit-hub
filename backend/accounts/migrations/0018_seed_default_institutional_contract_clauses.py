from pathlib import Path

from django.db import migrations


def seed_clauses(apps, schema_editor):
    SystemSettings = apps.get_model("accounts", "SystemSettings")
    snippet = (
        Path(__file__).resolve().parent.parent
        / "fixtures"
        / "default_institutional_contract_clauses_pt.txt"
    )
    if not snippet.is_file():
        return
    text = snippet.read_text(encoding="utf-8").strip()
    if not text:
        return
    for obj in SystemSettings.objects.all():
        if not (obj.contract_general_clauses or "").strip():
            obj.contract_general_clauses = text
            obj.save(update_fields=["contract_general_clauses"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0017_systemsettings_contract_include_clauses_on_sheet"),
    ]

    operations = [
        migrations.RunPython(seed_clauses, noop_reverse),
    ]
