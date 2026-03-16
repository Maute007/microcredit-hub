from django.conf import settings
from django.contrib.auth.models import AbstractUser, Permission
from django.db import models
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords


class Role(models.Model):
    """Role (papel) dinâmico com permissões atribuíveis. Ex: superuser, default, manager."""

    code = models.SlugField(max_length=50, unique=True, verbose_name=_("Código"))
    name = models.CharField(max_length=100, verbose_name=_("Nome"))
    description = models.TextField(blank=True, verbose_name=_("Descrição"))
    is_system = models.BooleanField(
        default=False,
        verbose_name=_("É sistema"),
        help_text=_("Roles de sistema (superuser, default) não podem ser removidas."),
    )
    permissions = models.ManyToManyField(
        Permission,
        blank=True,
        related_name="role_set",
        verbose_name=_("Permissões"),
    )
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Papel")
        verbose_name_plural = _("Papéis")
        ordering = ["name"]
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["is_system"]),
        ]

    def __str__(self):
        return self.name


class User(AbstractUser):
    """Usuário customizado. Login por username ou email.
    Permissões: herda de role.permissions + user_permissions.
    get_all_permissions inclui role para que DjangoModelPermissions funcione.
    """

    role = models.ForeignKey(
        "Role",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
        verbose_name=_("Papel"),
    )
    history = HistoricalRecords()

    def get_all_permissions(self, obj=None):
        """Inclui permissões do papel (role) para DjangoModelPermissions."""
        perms = set(super().get_all_permissions(obj))
        if self.role_id:
            from django.contrib.contenttypes.models import ContentType

            for p in self.role.permissions.select_related("content_type"):
                perms.add(f"{p.content_type.app_label}.{p.codename}")
        return perms

    class Meta:
        verbose_name = _("Usuário")
        verbose_name_plural = _("Usuários")
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["username"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["role"]),
            models.Index(fields=["email", "is_active"]),
            models.Index(fields=["username", "is_active"]),
        ]


class SystemSettings(models.Model):
  """Configurações globais do sistema (nome, branding, etc.). Singleton."""

  name = models.CharField(
      max_length=150,
      default="MAKIRA",
      verbose_name=_("Nome do sistema"),
  )
  logo_url = models.URLField(
      max_length=500,
      blank=True,
      null=True,
      verbose_name=_("Logo (URL)"),
  )
  primary_color = models.CharField(
      max_length=20,
      default="#0f766e",
      verbose_name=_("Cor primária"),
      help_text=_("Hex ou nome de cor CSS para destacar botões e cabeçalhos."),
  )
  tagline = models.CharField(
      max_length=200,
      blank=True,
      verbose_name=_("Frase de impacto (painel esquerdo)"),
      help_text=_("Ex.: Gestão moderna de microcrédito."),
  )
  login_description = models.TextField(
      blank=True,
      verbose_name=_("Descrição do painel esquerdo"),
      help_text=_("Parágrafo exibido no painel esquerdo do login (ecrã grande)."),
  )
  login_banner_color = models.CharField(
      max_length=20,
      blank=True,
      verbose_name=_("Cor do banner esquerdo (login)"),
      help_text=_("Cor do painel esquerdo. Vazio = usa cor primária."),
  )
  login_card_color = models.CharField(
      max_length=20,
      blank=True,
      verbose_name=_("Cor do cartão de login"),
      help_text=_("Cor de fundo específica para o cartão de login (deixe vazio para usar o padrão)."),
  )
  is_locked = models.BooleanField(
      default=False,
      verbose_name=_("Sistema bloqueado"),
      help_text=_("Quando activo, apenas superusers conseguem aceder ao sistema."),
  )
  locked_message = models.TextField(
      blank=True,
      verbose_name=_("Mensagem de bloqueio"),
      help_text=_("Texto mostrado aos utilizadores quando o sistema está temporariamente indisponível."),
  )
  updated_at = models.DateTimeField(auto_now=True)

  class Meta:
      verbose_name = _("Configuração do sistema")
      verbose_name_plural = _("Configurações do sistema")

  def __str__(self):
      return "Configurações do sistema"

  @classmethod
  def get_solo(cls):
      obj = cls.objects.first()
      if obj:
          return obj
      return cls.objects.create()


class Profile(models.Model):
    """Perfil estendido do usuário (OneToOne)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
        verbose_name=_("Usuário"),
    )
    phone = models.CharField(max_length=30, blank=True, verbose_name=_("Telefone"))
    avatar = models.URLField(max_length=500, blank=True, null=True, verbose_name=_("Avatar (URL)"))
    address = models.TextField(blank=True, verbose_name=_("Morada"))
    birth_date = models.DateField(null=True, blank=True, verbose_name=_("Data de nascimento"))
    job_title = models.CharField(max_length=100, blank=True, verbose_name=_("Cargo"))
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Perfil")
        verbose_name_plural = _("Perfis")
        indexes = [
            models.Index(fields=["user"]),
        ]

    def __str__(self):
        return f"{self.user.username} - Perfil"
