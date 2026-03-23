"""Permissões DRF para o módulo de contas."""

from django.contrib.auth.models import Permission
from rest_framework import permissions


def user_has_permission(user, perm: str) -> bool:
    """
    Verifica permissões reais do utilizador.

    Prioriza user.has_perm() e, como fallback, consulta o papel (Role.permissions)
    para cobrir cenários em que o backend de auth não agrega role perms.
    """
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    if user.has_perm(perm):
        return True
    role_id = getattr(user, "role_id", None)
    if not role_id:
        return False
    app_label, codename = perm.split(".", 1)
    return Permission.objects.filter(
        role_set__pk=role_id,
        content_type__app_label=app_label,
        codename=codename,
    ).exists()


class RoleAwareDjangoModelPermissions(permissions.DjangoModelPermissions):
    """
    Igual ao DjangoModelPermissions, com fallback ao papel (Role.permissions).
    """

    def has_permission(self, request, view):
        if super().has_permission(request, view):
            return True

        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True

        queryset = self._queryset(view)
        perms = self.get_required_permissions(request.method, queryset.model)
        return all(user_has_permission(user, perm) for perm in perms)


class CanListPermissionsForRoles(permissions.BasePermission):
    """
    Lista de permissões para configurar papéis.
    Quem gere utilizadores ou papéis precisa de ver as permissões disponíveis.
    """

    def has_permission(self, request, view):
        u = request.user
        if not u or not u.is_authenticated:
            return False
        return (
            user_has_permission(u, "accounts.view_role")
            or user_has_permission(u, "accounts.change_role")
            or user_has_permission(u, "accounts.add_role")
            or user_has_permission(u, "accounts.view_user")
            or user_has_permission(u, "accounts.change_user")
            or user_has_permission(u, "accounts.add_user")
        )


class CanPatchSystemSettings(permissions.BasePermission):
    """Actualizar configurações globais (branding, etc.), excepto bloqueio (só superuser no serializer)."""

    def has_permission(self, request, view):
        u = request.user
        if not u or not u.is_authenticated:
            return False
        return user_has_permission(u, "accounts.change_systemsettings")
