from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import Permission


User = get_user_model()


class UsernameOrEmailBackend(ModelBackend):
    """
    Autentica por username ou email.

    Inclui permissões do papel (Role.permissions) em get_all_permissions.
    No Django 5+, has_perm() consulta os backends — não usa User.get_all_permissions()
    personalizado; sem isto, só contavam user_permissions e groups.
    """

    def get_all_permissions(self, user_obj, obj=None):
        perms = super().get_all_permissions(user_obj, obj=obj)
        if not user_obj.is_active or getattr(user_obj, "is_anonymous", False) or obj is not None:
            return perms
        role_id = getattr(user_obj, "role_id", None)
        if not role_id:
            return perms
        extra = {
            f"{app}.{codename}"
            for app, codename in Permission.objects.filter(role_set__pk=role_id)
            .values_list("content_type__app_label", "codename")
        }
        merged = set(perms) | extra
        user_obj._perm_cache = merged
        return merged

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None or password is None:
            return None
        from django.db.models import Q

        user = User.objects.filter(
            Q(username__iexact=username) | Q(email__iexact=username)
        ).first()
        if user and user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
