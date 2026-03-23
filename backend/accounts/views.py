from django.contrib.auth.models import Permission
from django.db.models import Prefetch, Q
from django.http import Http404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Profile, Role, SystemSettings, User
from .permissions import (
    CanListPermissionsForRoles,
    CanPatchSystemSettings,
    RoleAwareDjangoModelPermissions,
    user_has_permission,
)
from .serializers import (
    PermissionSerializer,
    ProfileSerializer,
    RoleSerializer,
    SystemSettingsSerializer,
    UserMeSerializer,
    UserSerializer,
)


def _user_queryset():
    """Queryset otimizado para User: evita N+1 com select_related e prefetch_related."""
    return (
        User.objects.select_related("profile", "role")
        .prefetch_related(Prefetch("role__permissions", queryset=Permission.objects.select_related("content_type")))
        .order_by("id")
    )


class MeView(APIView):
    """Retorna o usuário autenticado com perfil, role e permissões."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = (
            User.objects.select_related("profile", "role")
            .prefetch_related("role__permissions", "user_permissions")
            .get(pk=request.user.pk)
        )
        return Response(UserMeSerializer(user).data)


class UserViewSet(viewsets.ModelViewSet):
    """CRUD de usuários. Queryset otimizado para evitar N+1."""

    serializer_class = UserSerializer
    permission_classes = [RoleAwareDjangoModelPermissions]

    def get_queryset(self):
        qs = _user_queryset()
        if not self.request.user.is_superuser:
            qs = qs.filter(is_superuser=False)
        is_active = self.request.query_params.get("is_active")
        role_id = self.request.query_params.get("role")
        search = self.request.query_params.get("search", "").strip()
        ordering = self.request.query_params.get("ordering", "id")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("true", "1", "yes"))
        if role_id:
            qs = qs.filter(role_id=role_id)
        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )
        if ordering.lstrip("-") in ("id", "username", "email", "date_joined"):
            qs = qs.order_by(ordering)
        return qs

    def get_object(self):
        obj = super().get_object()
        if obj.is_superuser and not self.request.user.is_superuser:
            raise Http404()
        return obj

    def perform_destroy(self, instance):
        if instance.is_superuser and not self.request.user.is_superuser:
            raise PermissionDenied(
                detail="Apenas um superutilizador pode eliminar outro superutilizador.",
            )
        super().perform_destroy(instance)


class ProfileViewSet(viewsets.ModelViewSet):
    """CRUD de perfis (ligados a User)."""

    serializer_class = ProfileSerializer
    permission_classes = [RoleAwareDjangoModelPermissions]

    def get_queryset(self):
        qs = Profile.objects.select_related("user").order_by("id")
        if not self.request.user.is_superuser:
            qs = qs.exclude(user__is_superuser=True)
        return qs


class RoleViewSet(viewsets.ModelViewSet):
    """CRUD de papéis com permissões dinâmicas. Evita N+1."""

    serializer_class = RoleSerializer
    permission_classes = [RoleAwareDjangoModelPermissions]
    search_fields = ["code", "name"]
    filterset_fields = ["is_system"]
    ordering_fields = ["id", "code", "name"]

    def get_queryset(self):
        qs = Role.objects.prefetch_related(
            Prefetch("permissions", queryset=Permission.objects.select_related("content_type"))
        )
        if not self.request.user.is_superuser:
            qs = qs.exclude(code="superuser")
        return qs.order_by("name")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_system:
            return Response(
                {"detail": "Papéis de sistema não podem ser removidos."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


_MODULE_LABELS = {
    "accounts": "Utilizadores & Acesso",
    "clients": "Clientes",
    "loans": "Empréstimos",
    "hr": "Recursos Humanos",
    "accounting": "Contabilidade",
    "calendario": "Calendário",
    "reports": "Relatórios",
    "dashboard": "Dashboard",
}

_ACTION_LABELS = {"view": "Ver", "add": "Criar", "change": "Editar", "delete": "Apagar"}


class PermissionListView(APIView):
    """Lista todas as permissões disponíveis (para atribuir a papéis dinamicamente)."""

    permission_classes = [CanListPermissionsForRoles]

    def get(self, request):
        group = request.query_params.get("format") == "by_module"
        perms = Permission.objects.select_related("content_type").order_by(
            "content_type__app_label", "codename"
        )
        if not group:
            return Response(PermissionSerializer(perms, many=True).data)

        # Formato: { modules: [ { key, label, resources: [ { model, label, actions: [view, add, change, delete] } ] } ] }
        by_mod = {}
        for p in perms:
            ct = p.content_type
            if not ct:
                continue
            app = ct.app_label
            model = ct.model
            action = None
            if p.codename.startswith("view_"):
                action = "view"
            elif p.codename.startswith("add_"):
                action = "add"
            elif p.codename.startswith("change_"):
                action = "change"
            elif p.codename.startswith("delete_"):
                action = "delete"
            if not action:
                continue
            if app not in by_mod:
                by_mod[app] = {"key": app, "label": _MODULE_LABELS.get(app, app), "resources": {}}
            if model not in by_mod[app]["resources"]:
                by_mod[app]["resources"][model] = {"model": model, "actions": {}}
            by_mod[app]["resources"][model]["actions"][action] = {
                "id": p.id,
                "codename": p.codename,
                "label": _ACTION_LABELS.get(action, action),
            }
        modules = []
        for m in sorted(by_mod.keys(), key=lambda k: _MODULE_LABELS.get(k, k)):
            res_list = [
                {"model": mod, "actions": data["actions"]}
                for mod, data in sorted(by_mod[m]["resources"].items())
            ]
            if res_list:
                modules.append({**by_mod[m], "resources": res_list})
        return Response({"modules": modules, "flat": PermissionSerializer(perms, many=True).data})


class SystemSettingsView(APIView):
    """Leitura/actualização das configurações globais do sistema (nome, logo, cores).
    GET é público — necessário na página de login para mostrar logo e cores.
    PATCH exige permissão accounts.change_systemsettings (ou superuser)."""

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [CanPatchSystemSettings()]

    def get(self, request):
        settings_obj = SystemSettings.get_solo()
        return Response(SystemSettingsSerializer(settings_obj).data)

    def patch(self, request):
        settings_obj = SystemSettings.get_solo()
        data = request.data.copy()
        # Apenas superuser pode alterar o estado de bloqueio
        if not request.user.is_superuser:
            data.pop("is_locked", None)
            data.pop("locked_message", None)
        serializer = SystemSettingsSerializer(settings_obj, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class DebugPermissionsView(APIView):
    """
    Diagnóstico de permissões efetivas do utilizador autenticado.

    Útil para confirmar porque um add/change/delete está a dar 403.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        perms = sorted(user.get_all_permissions())
        role_perms = []
        role = getattr(user, "role", None)
        if role is not None:
            role_perms = sorted(
                f"{p.content_type.app_label}.{p.codename}"
                for p in role.permissions.select_related("content_type").all()
            )

        sample_checks = [
            "clients.add_client",
            "clients.change_client",
            "clients.delete_client",
            "loans.add_loan",
            "loans.change_loan",
            "loans.delete_loan",
            "accounts.add_user",
            "accounts.change_user",
            "accounts.delete_user",
            "accounting.add_transaction",
            "accounting.change_transaction",
            "accounting.delete_transaction",
            "hr.add_employee",
            "hr.change_employee",
            "hr.delete_employee",
        ]

        checks = {
            perm: {
                "has_perm": bool(user.has_perm(perm)),
                "role_fallback": bool(user_has_permission(user, perm)),
            }
            for perm in sample_checks
        }

        return Response(
            {
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "is_superuser": user.is_superuser,
                    "is_staff": user.is_staff,
                    "role": {
                        "id": role.id if role else None,
                        "code": role.code if role else None,
                        "name": role.name if role else None,
                    },
                },
                "effective_permissions_count": len(perms),
                "effective_permissions": perms,
                "role_permissions_count": len(role_perms),
                "role_permissions": role_perms,
                "checks": checks,
            }
        )
