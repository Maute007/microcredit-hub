from decimal import Decimal

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
    """Utilizador customizado. Login por username ou email.

    As permissões do papel (Role.permissions) entram em has_perm() via
    ``UsernameOrEmailBackend.get_all_permissions`` — no Django 5+ o modelo
    não pode só sobrescrever get_all_permissions: o ORM usa os backends.
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
  # --- Banner login / hero: texto e alinhamento (parametrizável) ---
  login_banner_kicker = models.CharField(
      max_length=120,
      blank=True,
      verbose_name=_("Kicker do banner (selo)"),
      help_text=_("Texto pequeno em forma de selo no banner (ex.: nome do sistema). Vazio = usa nome."),
  )
  login_banner_image_url = models.URLField(
      max_length=600,
      blank=True,
      verbose_name=_("Imagem de fundo do banner (URL)"),
      help_text=_("URL opcional para imagem de fundo do banner (login e dashboard)."),
  )
  login_banner_title = models.CharField(
      max_length=300,
      blank=True,
      verbose_name=_("Título do banner (login)"),
      help_text=_("Se vazio, usa a frase de impacto (tagline)."),
  )
  login_banner_subtitle = models.CharField(
      max_length=400,
      blank=True,
      verbose_name=_("Subtítulo do banner"),
  )
  login_banner_body = models.TextField(
      blank=True,
      verbose_name=_("Corpo do banner"),
      help_text=_("Texto principal. Se vazio, usa a descrição do painel esquerdo."),
  )
  login_banner_text_align = models.CharField(
      max_length=12,
      default="left",
      verbose_name=_("Alinhamento do texto"),
      help_text=_("left, center, right ou justify"),
  )
  login_banner_block_align = models.CharField(
      max_length=12,
      default="start",
      verbose_name=_("Posição horizontal do bloco"),
      help_text=_("start, center ou end — no painel."),
  )
  login_banner_vertical_align = models.CharField(
      max_length=12,
      default="between",
      verbose_name=_("Distribuição vertical do painel"),
      help_text=_("start, center, end ou between (espaça topo e rodapé)."),
  )
  login_banner_max_width = models.CharField(
      max_length=32,
      default="100%",
      verbose_name=_("Largura máx. do bloco de texto"),
      help_text=_("Ex.: 36rem, 90%, 100%"),
  )
  login_banner_padding = models.CharField(
      max_length=32,
      default="0",
      verbose_name=_("Padding interno do bloco"),
      help_text=_("Ex.: 0, 1rem, 1.5rem 2rem"),
  )
  login_title_font_size = models.CharField(
      max_length=16,
      blank=True,
      verbose_name=_("Tamanho do título"),
      help_text=_("Ex.: 1.75rem ou 28px. Vazio = tamanho responsivo padrão."),
  )
  login_title_color = models.CharField(
      max_length=32,
      blank=True,
      verbose_name=_("Cor do título"),
      help_text=_("Ex.: #ffffff, rgb(...), var(--token). Vazio = cor padrão."),
  )
  login_subtitle_font_size = models.CharField(
      max_length=16,
      blank=True,
      verbose_name=_("Tamanho do subtítulo"),
  )
  login_subtitle_color = models.CharField(
      max_length=32,
      blank=True,
      verbose_name=_("Cor do subtítulo"),
      help_text=_("Vazio = cor padrão."),
  )
  login_body_font_size = models.CharField(
      max_length=16,
      blank=True,
      verbose_name=_("Tamanho do corpo"),
  )
  login_body_color = models.CharField(
      max_length=32,
      blank=True,
      verbose_name=_("Cor do corpo"),
      help_text=_("Vazio = cor padrão."),
  )
  login_show_feature_boxes = models.BooleanField(
      default=True,
      verbose_name=_("Mostrar caixas de destaques no login"),
  )

  # Calendário: rótulos configuráveis por tipo (categorias)
  calendar_type_labels = models.JSONField(
      default=dict,
      blank=True,
      verbose_name=_("Rótulos de categorias do calendário"),
      help_text=_("Mapa tipo->rótulo (ex.: meeting='Reunião')."),
  )

  # Empréstimos: política simples de juros e prazos comuns (em dias)
  loan_default_interest_rate = models.DecimalField(
      max_digits=5,
      decimal_places=2,
      default=Decimal("0.00"),
      verbose_name=_("Taxa de juro padrão (empréstimos) (%)"),
      help_text=_("Usada quando a categoria não define taxa padrão. Percentagem (ex.: 5 = 5%)."),
  )
  loan_allowed_terms_days = models.JSONField(
      default=list,
      blank=True,
      verbose_name=_("Prazos permitidos (dias)"),
      help_text=_("Lista de prazos em dias (ex.: 30, 60, 90, 120). Vazio = sem restrição."),
  )

  # Credor (dados para contratos e documentos)
  creditor_legal_name = models.CharField(
      max_length=200,
      blank=True,
      verbose_name=_("Nome legal do credor"),
      help_text=_("Ex.: Kuchukuro Microcrédito E.I (Eurocrédito). Se vazio, usa o nome do sistema."),
  )
  creditor_address = models.CharField(
      max_length=300,
      blank=True,
      verbose_name=_("Morada/sede do credor"),
      help_text=_("Ex.: Av. 25 de Setembro..., Prédio..., Cidade..."),
  )
  creditor_city = models.CharField(
      max_length=120,
      blank=True,
      verbose_name=_("Cidade do credor"),
      help_text=_("Ex.: Maputo"),
  )

  # Contrato (modelo de folha)
  contract_theme_color = models.CharField(
      max_length=20,
      blank=True,
      verbose_name=_("Cor do contrato (tema)"),
      help_text=_("Hex/CSS. Vazio = usa cor primária."),
  )
  contract_page_bg_color = models.CharField(
      max_length=20,
      blank=True,
      verbose_name=_("Cor de fundo da folha (contrato)"),
      help_text=_("Cor da página inteira ao imprimir. Vazio = branco."),
  )
  contract_logo_url = models.URLField(
      max_length=600,
      blank=True,
      verbose_name=_("Logo do contrato (URL)"),
      help_text=_("Logo exibido na folha do contrato. Vazio = usa o logo do sistema."),
  )
  contract_logo = models.ImageField(
      upload_to="contract_logos/",
      blank=True,
      null=True,
      verbose_name=_("Logo do contrato (ficheiro)"),
      help_text=_("Opcional: imagem carregada no servidor (tem prioridade sobre a URL)."),
  )
  contract_header_title = models.CharField(
      max_length=120,
      blank=True,
      verbose_name=_("Título do cabeçalho do contrato"),
      help_text=_("Ex.: MicroCrédito Solidário"),
  )
  contract_header_subtitle = models.CharField(
      max_length=200,
      blank=True,
      verbose_name=_("Subtítulo do cabeçalho do contrato"),
      help_text=_("Ex.: Instituição de crédito comunitário • Moçambique"),
  )
  contract_doc_badge = models.CharField(
      max_length=120,
      blank=True,
      verbose_name=_("Selo do documento"),
      help_text=_("Ex.: Documento oficial"),
  )
  contract_general_clauses = models.TextField(
      blank=True,
      verbose_name=_("Cláusulas gerais do contrato (secção 03)"),
      help_text=_(
          "Texto legal fixo da instituição para a secção “Condições gerais e obrigações” da folha de contrato. "
          "Isto é o contrato/modelo institucional. Os “Termos e condições” da categoria vêm do tipo de empréstimo e são anexados à parte."
      ),
  )
  contract_include_clauses_on_sheet = models.BooleanField(
      default=True,
      verbose_name=_("Incluir cláusulas institucionais na folha"),
      help_text=_(
          "Quando desactivo, a folha (secção 03) não mostra o bloco de cláusulas gerais da instituição "
          "(nem a lista breve por omissão). Os termos da categoria do empréstimo mantêm-se se existirem."
      ),
  )

  # BdM Report — informações da instituição
  bom_province = models.CharField(max_length=100, blank=True, verbose_name=_("Província (relatório BdM)"))
  bom_phone = models.CharField(max_length=50, blank=True, verbose_name=_("Telefone (relatório BdM)"))
  bom_fax = models.CharField(max_length=50, blank=True, verbose_name=_("Fax (relatório BdM)"))
  bom_email = models.EmailField(max_length=254, blank=True, verbose_name=_("E-mail da instituição (relatório BdM)"))
  bom_num_workers = models.PositiveIntegerField(default=1, verbose_name=_("Nº de Trabalhadores"))
  bom_start_date = models.CharField(max_length=100, blank=True, verbose_name=_("Data de Início das Actividades"), help_text=_("Ex.: Dezembro de 2024"))
  bom_operator_name = models.CharField(max_length=200, blank=True, verbose_name=_("Nome do Operador"))

  # BdM Report — dados financeiros estáticos
  bom_initial_capital = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal("0.00"), verbose_name=_("Capital Inicial (MZN)"))
  bom_current_capital = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal("0.00"), verbose_name=_("Capital Actual (MZN)"))
  bom_own_capital = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal("0.00"), verbose_name=_("Capitais Próprios (MZN)"))
  bom_foreign_capital_national = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal("0.00"), verbose_name=_("Capitais Alheios Nacionais (MZN)"))
  bom_foreign_capital_foreign = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal("0.00"), verbose_name=_("Capitais Alheios Estrangeiros (MZN)"))
  bom_financing_loans = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal("0.00"), verbose_name=_("Empréstimos obtidos no período (MZN)"))
  bom_financing_donations = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal("0.00"), verbose_name=_("Donativos obtidos no período (MZN)"))
  bom_financing_capital_increase = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal("0.00"), verbose_name=_("Aumento do capital com recursos próprios (MZN)"))
  # Situação financeira (3 meses): store as JSON list of {caixa, bancos, outros_activos}
  bom_financial_situation = models.JSONField(default=list, blank=True, verbose_name=_("Situação Financeira (3 meses)"), help_text=_("Lista de 3 objectos: [{caixa, bancos, outros_activos}, ...]"))

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
