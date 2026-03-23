"""Permissões DRF para o módulo de contas (além de DjangoModelPermissions)."""

from rest_framework import permissions


class CanListPermissionsForRoles(permissions.BasePermission):
    """
    Lista de permissões para configurar papéis.
    Quem gere utilizadores ou papéis precisa de ver as permissões disponíveis.
    """

    def has_permission(self, request, view):
        u = request.user
        if not u or not u.is_authenticated:
            return False
        if u.is_superuser:
            return True
        return (
            u.has_perm("accounts.view_role")
            or u.has_perm("accounts.change_role")
            or u.has_perm("accounts.add_role")
            or u.has_perm("accounts.view_user")
            or u.has_perm("accounts.change_user")
            or u.has_perm("accounts.add_user")
        )


class CanPatchSystemSettings(permissions.BasePermission):
    """Actualizar configurações globais (branding, etc.), excepto bloqueio (só superuser no serializer)."""

    def has_permission(self, request, view):
        u = request.user
        if not u or not u.is_authenticated:
            return False
        return u.is_superuser or u.has_perm("accounts.change_systemsettings")
