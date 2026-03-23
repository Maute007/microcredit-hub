"""
Migrações + papéis (JSON) + superutilizador bootstrap (settings).

Uso típico após clone ou em CI:
  python manage.py bootstrap_system

Variáveis .env opcionais:
  BOOTSTRAP_SUPERUSER_USERNAME (default: Maute007)
  BOOTSTRAP_SUPERUSER_PASSWORD (obrigatório para criar superuser; há default em settings só para conveniência local)
"""

from __future__ import annotations

from django.core.management import call_command
from django.core.management.base import BaseCommand

from accounts.bootstrap import ensure_primary_superuser
from accounts.models import SystemSettings


class Command(BaseCommand):
    help = "migrate + seed_roles + superutilizador bootstrap + SystemSettings"

    def add_arguments(self, parser):
        parser.add_argument(
            "--skip-seed-roles",
            action="store_true",
            help="Não executar seed_roles (só migrate + superuser + settings).",
        )
        parser.add_argument(
            "--skip-superuser",
            action="store_true",
            help="Não criar/actualizar superutilizador bootstrap.",
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("migrate..."))
        call_command("migrate", interactive=False, verbosity=1)

        if not options["skip_seed_roles"]:
            self.stdout.write(self.style.NOTICE("seed_roles..."))
            call_command("seed_roles", verbosity=1)

        SystemSettings.get_solo()
        self.stdout.write(self.style.SUCCESS("SystemSettings OK."))

        if not options["skip_superuser"]:
            ensure_primary_superuser(stdout=self.stdout)

        self.stdout.write(self.style.SUCCESS("bootstrap_system concluído."))
