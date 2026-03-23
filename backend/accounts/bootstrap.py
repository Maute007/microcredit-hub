"""
Cria ou actualiza o superutilizador parametrizado em settings (bootstrap).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.conf import settings

from .models import Profile, Role, SystemSettings, User

if TYPE_CHECKING:
    from django.core.management.base import OutputWrapper


def ensure_primary_superuser(stdout: OutputWrapper | None = None) -> User | None:
    """
    Garante utilizador BOOTSTRAP_SUPERUSER_USERNAME com is_superuser=True.
    Palavra-passe: BOOTSTRAP_SUPERUSER_PASSWORD; se vazia, não faz nada.
    """
    username = getattr(settings, "BOOTSTRAP_SUPERUSER_USERNAME", "") or ""
    password = getattr(settings, "BOOTSTRAP_SUPERUSER_PASSWORD", "") or ""
    if not username.strip() or not password:
        if stdout:
            stdout.write("Bootstrap superuser ignorado: username ou password vazios (defina no .env).")
        return None

    SystemSettings.get_solo()
    role_super = Role.objects.filter(code="superuser").first()

    user, created = User.objects.get_or_create(
        username=username.strip(),
        defaults={
            "email": f"{username.strip()}@local",
            "first_name": "Administrador",
            "last_name": "",
            "is_active": True,
            "is_staff": True,
            "is_superuser": True,
            "role": role_super,
        },
    )
    user.is_superuser = True
    user.is_staff = True
    user.is_active = True
    if role_super:
        user.role = role_super
    user.set_password(password)
    user.save()
    Profile.objects.get_or_create(user=user)

    if stdout:
        stdout.write(f"Superutilizador garantido: {user.username} ({'criado' if created else 'actualizado'})")
    return user
