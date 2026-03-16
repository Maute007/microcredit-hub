from django.db import migrations


def create_default_roles(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    if not Role.objects.filter(code="superuser").exists():
        Role.objects.create(
            code="superuser",
            name="Superutilizador",
            description="Acesso total ao sistema.",
            is_system=True,
        )
    if not Role.objects.filter(code="default").exists():
        Role.objects.create(
            code="default",
            name="Utilizador padrão",
            description="Utilizador com permissões básicas.",
            is_system=True,
        )


def reverse_default_roles(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Role.objects.filter(code__in=["superuser", "default"], is_system=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_default_roles, reverse_default_roles),
    ]
