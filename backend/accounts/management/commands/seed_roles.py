"""
Cria ou actualiza papéis (Role) e permissões conforme accounts/config/role_permissions.json

Uso:
  python manage.py seed_roles
  python manage.py seed_roles --demo-users --password=MinhaSenhaSegura
"""

from __future__ import annotations

from django.contrib.auth.models import Permission
from django.core.management.base import BaseCommand, CommandError

from accounts.models import Profile, Role, User
from accounts.role_permissions_loader import (
    get_demo_users_definitions,
    get_roles_definitions,
    load_role_permissions_config,
)


def resolve_permissions(
    mode: str | None, codenames: list[str] | None
) -> tuple[list[Permission], list[str]]:
    if mode == "all":
        perms = list(Permission.objects.all().order_by("content_type__app_label", "codename"))
        return perms, []
    if mode in ("none", None):
        return [], []
    if mode == "list":
        if not codenames:
            return [], []
        found = list(Permission.objects.filter(codename__in=codenames).select_related("content_type"))
        found_set = {p.codename for p in found}
        missing = [c for c in codenames if c not in found_set]
        return found, missing
    raise ValueError(f"permissions_mode inválido: {mode!r}")


class Command(BaseCommand):
    help = "Sincroniza papéis (Role) e permissões a partir de role_permissions.json"

    def add_arguments(self, parser):
        parser.add_argument(
            "--demo-users",
            action="store_true",
            help="Cria utilizadores de demonstração (secção demo_users do JSON) se ainda não existirem.",
        )
        parser.add_argument(
            "--password",
            default="",
            help="Palavra-passe para utilizadores demo (obrigatório com --demo-users).",
        )

    def handle(self, *args, **options):
        try:
            config = load_role_permissions_config()
        except FileNotFoundError as e:
            raise CommandError(str(e)) from e

        roles_defs = get_roles_definitions(config)
        created_roles = 0
        updated_roles = 0

        for rd in roles_defs:
            code = rd.get("code")
            if not code:
                raise CommandError("Cada papel precisa de 'code'.")

            name = rd.get("name") or code
            description = rd.get("description") or ""
            is_system = bool(rd.get("is_system", False))
            mode = rd.get("permissions_mode", "none")
            codenames = rd.get("permissions") or []

            perms, missing = resolve_permissions(mode if mode == "list" else mode, codenames if mode == "list" else None)
            for m in missing:
                self.stdout.write(self.style.WARNING(f"  Permissão desconhecida (ignorada): {m}"))

            role, was_created = Role.objects.update_or_create(
                code=code,
                defaults={
                    "name": name,
                    "description": description,
                    "is_system": is_system,
                },
            )
            role.permissions.set(perms)
            if was_created:
                created_roles += 1
                self.stdout.write(self.style.SUCCESS(f"Papel criado: {code}"))
            else:
                updated_roles += 1
                self.stdout.write(self.style.NOTICE(f"Papel actualizado: {code} ({len(perms)} permissões)"))

        self.stdout.write(self.style.SUCCESS(f"Concluído. Criados: {created_roles}, actualizados: {updated_roles}."))

        if options["demo_users"]:
            pwd = (options.get("password") or "").strip()
            if not pwd:
                raise CommandError("Use --password=... com --demo-users.")
            self._seed_demo_users(config, pwd)

    def _seed_demo_users(self, config: dict, password: str) -> None:
        for u in get_demo_users_definitions(config):
            username = u.get("username")
            role_code = u.get("role_code")
            if not username or not role_code:
                self.stdout.write(self.style.WARNING("Entrada demo_users incompleta, ignorada."))
                continue
            role = Role.objects.filter(code=role_code).first()
            if not role:
                self.stdout.write(self.style.WARNING(f"Role {role_code} não existe, ignorado: {username}"))
                continue
            is_staff = bool(u.get("is_staff", False))
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": u.get("email") or f"{username}@local",
                    "first_name": u.get("first_name") or username,
                    "last_name": u.get("last_name") or "",
                    "is_active": True,
                    "is_staff": is_staff,
                    "is_superuser": False,
                    "role": role,
                },
            )
            if not created:
                user.role = role
                user.email = u.get("email") or user.email
                user.first_name = u.get("first_name") or user.first_name
                user.is_staff = is_staff
                user.save()
            user.set_password(password)
            user.save()
            Profile.objects.get_or_create(user=user)
            self.stdout.write(
                self.style.SUCCESS(f"Utilizador demo {'criado' if created else 'actualizado'}: {username}")
            )
