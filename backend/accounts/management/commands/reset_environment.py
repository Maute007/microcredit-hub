"""
Apaga todos os dados da base (flush), mantendo migrações, e volta a criar papéis conforme JSON.

ATENÇÃO: remove utilizadores, histórico (simple_history), transacções, etc.

Uso:
  python manage.py reset_environment --confirm
  python manage.py reset_environment --confirm --demo-users --password=SenhaForte123

Após reset, o superutilizador bootstrap (BOOTSTRAP_SUPERUSER_USERNAME / _PASSWORD em settings ou .env)
é criado automaticamente. Opcionalmente --admin-password cria também o utilizador interno "admin"
com papel "admin" (não superutilizador).
"""

from __future__ import annotations

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from accounts.bootstrap import ensure_primary_superuser
from accounts.models import Profile, Role, SystemSettings, User


class Command(BaseCommand):
    help = "Flush da base de dados + seed de papéis (e opcionalmente utilizadores demo / admin interno)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Obrigatório: confirma que pretende apagar todos os dados.",
        )
        parser.add_argument(
            "--demo-users",
            action="store_true",
            help="Cria utilizadores da secção demo_users do role_permissions.json",
        )
        parser.add_argument(
            "--password",
            default="",
            help="Palavra-passe para utilizadores demo (com --demo-users).",
        )
        parser.add_argument(
            "--admin-password",
            default="",
            help='Se definido, cria ou actualiza o utilizador "admin" como administrador interno.',
        )

    def handle(self, *args, **options):
        if not options["confirm"]:
            raise CommandError(
                "Esta operação apaga TODOS os dados. Execute com --confirm após fazer backup."
            )

        self.stdout.write(self.style.WARNING("A executar flush (todos os dados serão removidos)..."))
        call_command("flush", interactive=False, verbosity=1)

        # Repõe ContentType + Permission (flush esvazia auth_permission)
        self.stdout.write(self.style.NOTICE("A executar migrate (recriar permissões Django)..."))
        call_command("migrate", interactive=False, verbosity=1)

        self.stdout.write(self.style.NOTICE("A sincronizar papéis (seed_roles)..."))
        seed_args = []
        if options["demo_users"]:
            pwd = (options.get("password") or "").strip()
            if not pwd:
                raise CommandError("Com --demo-users indique também --password=...")
            seed_args = ["--demo-users", f"--password={pwd}"]
        call_command("seed_roles", *seed_args, verbosity=1)

        SystemSettings.get_solo()
        self.stdout.write(self.style.SUCCESS("SystemSettings inicializado."))

        ensure_primary_superuser(stdout=self.stdout)

        admin_pwd = (options.get("admin_password") or "").strip()
        if admin_pwd:
            role_admin = Role.objects.filter(code="admin").first()
            if role_admin is None:
                raise CommandError('Papel "admin" não encontrado. Execute seed_roles primeiro.')
            admin, created = User.objects.get_or_create(
                username="admin",
                defaults={
                    "email": "admin@local",
                    "first_name": "Administrador Interno",
                    "last_name": "",
                    "is_active": True,
                    "is_staff": True,
                    "is_superuser": False,
                    "role": role_admin,
                },
            )
            if not created:
                admin.is_superuser = False
                admin.is_staff = True
                admin.is_active = True
                admin.role = role_admin
                admin.save()
            admin.set_password(admin_pwd)
            admin.save()
            Profile.objects.get_or_create(user=admin)
            self.stdout.write(self.style.SUCCESS('Administrador interno "admin" criado ou actualizado.'))

        self.stdout.write(self.style.SUCCESS("reset_environment concluído."))
