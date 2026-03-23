"""
Cria/actualiza um utilizador administrador interno (papel "admin"), sem privilégios de dono.

Uso:
  python manage.py create_internal_admin --username=admin.empresa --password='SenhaForte123'
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from accounts.models import Profile, Role, User


class Command(BaseCommand):
    help = "Cria ou actualiza um administrador interno (role=admin, is_superuser=False)."

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True, help="Nome de utilizador do admin interno.")
        parser.add_argument("--password", required=True, help="Palavra-passe do admin interno.")
        parser.add_argument("--email", default="", help="Email (opcional).")
        parser.add_argument("--first-name", default="Administrador", help="Primeiro nome.")
        parser.add_argument("--last-name", default="Interno", help="Último nome.")

    def handle(self, *args, **options):
        username = (options["username"] or "").strip()
        password = (options["password"] or "").strip()
        email = (options.get("email") or "").strip()
        first_name = (options.get("first_name") or "").strip()
        last_name = (options.get("last_name") or "").strip()

        if not username:
            raise CommandError("--username é obrigatório.")
        if not password:
            raise CommandError("--password é obrigatório.")

        role_admin = Role.objects.filter(code="admin").first()
        if role_admin is None:
            raise CommandError('Papel "admin" não encontrado. Execute seed_roles antes.')

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "is_active": True,
                "is_staff": True,
                "is_superuser": False,
                "role": role_admin,
            },
        )

        if not created:
            user.email = email or user.email
            user.first_name = first_name or user.first_name
            user.last_name = last_name or user.last_name
            user.is_active = True
            user.is_staff = True
            user.is_superuser = False
            user.role = role_admin

        user.set_password(password)
        user.save()
        Profile.objects.get_or_create(user=user)

        action = "criado" if created else "actualizado"
        self.stdout.write(self.style.SUCCESS(f'Administrador interno "{username}" {action} com sucesso.'))
