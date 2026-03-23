from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.db.models import Q
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from hr.models import Employee
from .models import Profile, Role, SystemSettings

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Login com identifier (username ou email) + password."""

    username_field = "identifier"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["identifier"] = self.fields.pop("username", serializers.CharField())

    def validate(self, attrs):
        identifier = attrs.get("identifier")
        password = attrs.get("password")
        user = User.objects.filter(
            Q(username__iexact=identifier) | Q(email__iexact=identifier)
        ).first()
        if not user or not user.check_password(password):
            raise serializers.ValidationError("Credenciais inválidas.")
        if not user.is_active:
            raise serializers.ValidationError("Conta inativa.")
        refresh = self.get_token(user)
        # Serializa o utilizador para JSON seguro (sem retornar o objeto User diretamente)
        user_data = UserMeSerializer(user).data
        return {
            "user": user_data,
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }


# --- Profile, Role, Permission ---


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ["id", "phone", "avatar", "address", "birth_date", "job_title"]
        read_only_fields = ["id"]


def _model_display_name(content_type) -> str:
    """Nome amigável do modelo a partir de verbose_name. Ex: historicalclient → Histórico de clientes."""
    if not content_type:
        return ""
    model_class = content_type.model_class()
    if not model_class:
        return content_type.model
    meta = model_class._meta
    vn = getattr(meta, "verbose_name", None) or meta.model_name
    if callable(vn):
        vn = str(vn)
    vn = str(vn).strip()
    if vn.lower().startswith("historical "):
        base = vn[10:].strip()
        return f"Histórico de {base}" if base else "Histórico"
    return vn


class PermissionSerializer(serializers.ModelSerializer):
    app_label = serializers.CharField(source="content_type.app_label", read_only=True)
    model = serializers.CharField(source="content_type.model", read_only=True)
    model_display_name = serializers.SerializerMethodField()

    class Meta:
        model = Permission
        fields = ["id", "codename", "name", "app_label", "model", "model_display_name"]

    def get_model_display_name(self, obj):
        ct = getattr(obj, "content_type", None)
        if not ct:
            return obj.content_type_id and str(obj.content_type_id) or ""
        return _model_display_name(ct)


class RoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)
    permissions_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Permission.objects.all(),
        source="permissions",
        write_only=True,
        required=False,
    )

    class Meta:
        model = Role
        fields = ["id", "code", "name", "description", "is_system", "permissions", "permissions_ids"]
        read_only_fields = ["id", "is_system"]

    def create(self, validated_data):
        perms = validated_data.pop("permissions", [])
        role = Role.objects.create(**validated_data)
        if perms:
            role.permissions.set(perms)
        return role

    def update(self, instance, validated_data):
        perms = validated_data.pop("permissions", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        if perms is not None:
            instance.permissions.set(perms)
        return instance


class RoleMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "code", "name"]


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    role = RoleMinimalSerializer(read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        source="role",
        write_only=True,
        required=False,
        allow_null=True,
    )
    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(),
        source="employee",
        write_only=True,
        required=False,
        allow_null=True,
    )
    employee_name = serializers.CharField(source="employee.name", read_only=True, default=None)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
            "role",
            "role_id",
            "employee_id",
            "employee_name",
            "profile",
            "permissions",
        ]
        read_only_fields = ["id", "date_joined"]
        extra_kwargs = {
            "password": {"write_only": True, "required": False},
            "is_staff": {"default": False},
            "is_superuser": {"default": False},
        }

    def validate(self, attrs):
        request = self.context.get("request")
        actor = getattr(request, "user", None) if request else None
        acting_super = bool(actor and actor.is_authenticated and actor.is_superuser)
        if not acting_super:
            attrs.pop("is_superuser", None)
            attrs.pop("is_staff", None)
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        role = validated_data.pop("role", None)
        employee = validated_data.pop("employee", None)
        user = User.objects.create(**validated_data, role=role)
        if password:
            user.set_password(password)
            user.save()
        if employee is not None:
            employee.user = user
            employee.save(update_fields=["user"])
        Profile.objects.get_or_create(user=user)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        role = validated_data.pop("role", None)
        employee = validated_data.pop("employee", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if role is not None:
            instance.role = role
        if employee is not None:
            # Desassociar de colaborador anterior, se existir
            try:
                old_emp = instance.employee
            except Employee.DoesNotExist:
                old_emp = None
            if old_emp and old_emp != employee:
                old_emp.user = None
                old_emp.save(update_fields=["user"])
            # Ligar ao novo colaborador
            employee.user = instance
            employee.save(update_fields=["user"])
        if password:
            instance.set_password(password)
        instance.save()
        return instance

    def get_permissions(self, obj):
        perms = set()
        if obj.is_superuser:
            return ["*"]
        if obj.role_id:
            perms.update(obj.role.permissions.values_list("codename", flat=True))
        perms.update(obj.user_permissions.values_list("codename", flat=True))
        return sorted(perms)


class UserMeSerializer(serializers.ModelSerializer):
    """Current user with profile, role and effective permissions."""

    profile = ProfileSerializer(read_only=True)
    role = RoleMinimalSerializer(read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_superuser",
            "is_staff",
            "is_active",
            "date_joined",
            "role",
            "profile",
            "permissions",
        ]

    def get_permissions(self, obj):
        perms = set()
        if obj.is_superuser:
            return ["*"]
        if obj.role_id:
            perms.update(obj.role.permissions.values_list("codename", flat=True))
        perms.update(obj.user_permissions.values_list("codename", flat=True))
        return sorted(perms)


class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = [
            "id",
            "name",
            "logo_url",
            "primary_color",
            "tagline",
            "login_description",
            "login_banner_color",
            "login_card_color",
            "login_banner_title",
            "login_banner_subtitle",
            "login_banner_body",
            "login_banner_text_align",
            "login_banner_block_align",
            "login_banner_vertical_align",
            "login_banner_max_width",
            "login_banner_padding",
            "login_title_font_size",
            "login_subtitle_font_size",
            "login_body_font_size",
            "login_show_feature_boxes",
            "is_locked",
            "locked_message",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]
