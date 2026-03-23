from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords


class LoanCategory(models.Model):
    """Categoria/política de empréstimo configurável pelo admin."""

    name = models.CharField(max_length=100, verbose_name=_("Nome"))
    code = models.CharField(max_length=50, unique=True, verbose_name=_("Código"))
    description = models.TextField(blank=True, verbose_name=_("Descrição"))
    terms_and_conditions = models.TextField(
        blank=True,
        verbose_name=_("Termos e condições (T&C)"),
        help_text=_(
            "Texto legal ou comercial aplicável a esta categoria. "
            "Aparece no contrato quando um empréstimo usa esta categoria."
        ),
    )

    # Intervalo de valor (para atribuição automática)
    min_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name=_("Montante mínimo (MT)"),
        help_text=_("Empréstimos com montante >= este valor podem usar esta categoria."),
    )
    max_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_("Montante máximo (MT)"),
        help_text=_("Empréstimos com montante <= este valor (ou sem limite se vazio)."),
    )

    # Frequência e prazos
    frequency_days = models.PositiveIntegerField(
        default=30,
        verbose_name=_("Frequência de pagamento (dias)"),
        help_text=_("Ex.: 30 = mensal, 15 = quinzenal, 365 = anual."),
    )
    min_term_days = models.PositiveIntegerField(
        default=30,
        verbose_name=_("Duração mínima do contrato (dias)"),
        help_text=_("Menor prazo permitido para o empréstimo, em dias."),
    )
    max_term_days = models.PositiveIntegerField(
        default=365,
        verbose_name=_("Duração máxima do contrato (dias)"),
        help_text=_("Maior prazo permitido; deve ser ≥ duração mínima."),
    )
    min_installments = models.PositiveIntegerField(
        default=1,
        verbose_name=_("Número mínimo de parcelas"),
    )
    max_installments = models.PositiveIntegerField(
        default=12,
        verbose_name=_("Número máximo de parcelas"),
    )

    # Defaults financeiros para novos empréstimos desta categoria
    default_interest_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name=_("Taxa de juro padrão (%)"),
        help_text=_("Taxa sugerida ao criar um novo empréstimo desta categoria (não altera empréstimos já existentes)."),
    )
    default_term_months = models.PositiveIntegerField(
        default=12,
        verbose_name=_("Prazo padrão (meses)"),
        help_text=_("Número de meses sugerido ao criar um novo empréstimo desta categoria."),
    )

    # Juros de mora (após prazo)
    late_interest_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name=_("Taxa de juros de mora (%)"),
        help_text=_("Percentagem mensal sobre saldo em atraso. Ex.: 2 = 2% ao mês."),
    )
    max_late_interest_months = models.PositiveIntegerField(
        default=12,
        verbose_name=_("Máx. meses de juros de mora"),
        help_text=_("Após este número de meses, os juros param de acumular."),
    )

    # Garantia
    collateral_grace_days = models.PositiveIntegerField(
        default=60,
        verbose_name=_("Tolerância para perda da garantia (dias)"),
        help_text=_("Após este período de atraso sem cumprir condições, a garantia pode ser executada."),
    )
    require_interest_paid_to_keep_collateral = models.BooleanField(
        default=True,
        verbose_name=_("Manter garantia se juros pagos"),
        help_text=_("Se activo, pagar juros a cada período evita perder o bem, mesmo com principal em aberto."),
    )

    is_active = models.BooleanField(default=True, verbose_name=_("Ativa"))
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Categoria de Empréstimo")
        verbose_name_plural = _("Categorias de Empréstimo")
        ordering = ["name"]
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        errs = {}
        if self.min_term_days > self.max_term_days:
            errs["max_term_days"] = _(
                "A duração máxima (dias) deve ser maior ou igual à duração mínima."
            )
        if self.min_installments > self.max_installments:
            errs["max_installments"] = _(
                "O número máximo de parcelas deve ser maior ou igual ao mínimo."
            )
        if self.max_amount is not None and self.min_amount > self.max_amount:
            errs["max_amount"] = _(
                "O montante máximo deve ser maior ou igual ao montante mínimo."
            )
        if errs:
            raise ValidationError(errs)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Loan(models.Model):
    """Empréstimo de microcrédito."""

    STATUS_CHOICES = [
        ("ativo", _("Ativo")),
        ("pago", _("Pago")),
        ("atrasado", _("Atrasado")),
        ("pendente", _("Pendente")),
    ]

    client = models.ForeignKey(
        "clients.Client",
        on_delete=models.CASCADE,
        related_name="loans",
        verbose_name=_("Cliente"),
    )
    category = models.ForeignKey(
        LoanCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loans",
        verbose_name=_("Categoria"),
    )
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        verbose_name=_("Montante"),
    )
    interest_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name=_("Taxa de juro (%)"),
    )
    term = models.PositiveIntegerField(verbose_name=_("Prazo (meses)"))
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pendente",
        verbose_name=_("Estado"),
    )
    start_date = models.DateField(verbose_name=_("Data início"))
    end_date = models.DateField(verbose_name=_("Data fim"))
    monthly_payment = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name=_("Prestação mensal"),
    )
    total_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name=_("Montante total"),
    )
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Empréstimo")
        verbose_name_plural = _("Empréstimos")
        ordering = ["-start_date"]
        indexes = [
            models.Index(fields=["client"]),
            models.Index(fields=["status"]),
            models.Index(fields=["start_date"]),
        ]

    def __str__(self):
        return f"{self.client.name} - {self.amount} MT"


class Collateral(models.Model):
    """Item de garantia deixado pelo cliente no âmbito do empréstimo."""

    TYPE_CHOICES = [
        ("documento", _("Documento")),
        ("eletronico", _("Eletrónico")),
        ("veiculo", _("Veículo")),
        ("imovel", _("Imóvel")),
        ("joias", _("Joias/Ourivesaria")),
        ("maquinaria", _("Maquinaria/Equipamento")),
        ("outro", _("Outro")),
    ]

    CONDITION_CHOICES = [
        ("novo", _("Novo")),
        ("bom", _("Bom estado")),
        ("usado", _("Usado")),
        ("danificado", _("Danificado")),
        ("não_aplicavel", _("Não aplicável")),
    ]

    loan = models.OneToOneField(
        Loan,
        on_delete=models.CASCADE,
        related_name="collateral",
        verbose_name=_("Empréstimo"),
    )
    description = models.CharField(
        max_length=500,
        verbose_name=_("Descrição do item"),
        help_text=_("Descrição detalhada do item de garantia"),
    )
    item_type = models.CharField(
        max_length=30,
        choices=TYPE_CHOICES,
        default="outro",
        verbose_name=_("Tipo de item"),
    )
    estimated_value = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_("Valor estimado (MT)"),
    )
    condition = models.CharField(
        max_length=30,
        choices=CONDITION_CHOICES,
        default="não_aplicavel",
        verbose_name=_("Estado/Conservação"),
    )
    serial_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_("Número de série / Identificação"),
    )
    notes = models.TextField(
        blank=True,
        verbose_name=_("Observações"),
    )
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Item de garantia")
        verbose_name_plural = _("Itens de garantia")
        indexes = [models.Index(fields=["loan"])]

    def __str__(self):
        return f"{self.get_item_type_display()}: {self.description[:50]}"


class Payment(models.Model):
    """Pagamento de prestação."""

    STATUS_CHOICES = [
        ("pago", _("Pago")),
        ("pendente", _("Pendente")),
        ("atrasado", _("Atrasado")),
    ]

    METHOD_CHOICES = [
        ("transferencia", _("Transferência")),
        ("m_pesa", _("M-Pesa")),
        ("emola_mkesh", _("eMola Mkesh")),
        ("deposito", _("Depósito")),
        ("dinheiro", _("Dinheiro")),
        ("outro", _("Outro")),
    ]

    loan = models.ForeignKey(
        Loan,
        on_delete=models.CASCADE,
        related_name="payments",
        verbose_name=_("Empréstimo"),
    )
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        verbose_name=_("Montante"),
    )
    date = models.DateField(verbose_name=_("Data"))
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pendente",
        verbose_name=_("Estado"),
    )
    method = models.CharField(
        max_length=30,
        choices=METHOD_CHOICES,
        default="outro",
        verbose_name=_("Método"),
    )
    method_other = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_("Especificar método (quando Outro)"),
    )
    installment_number = models.PositiveIntegerField(
        default=1,
        verbose_name=_("Número da prestação"),
    )
    receipt = models.CharField(max_length=200, blank=True, verbose_name=_("Referência do recibo"))
    receipt_file = models.FileField(
        upload_to="payments/receipts/%Y/%m/",
        blank=True,
        null=True,
        verbose_name=_("Ficheiro do recibo"),
    )
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Pagamento")
        verbose_name_plural = _("Pagamentos")
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["loan"]),
            models.Index(fields=["status"]),
            models.Index(fields=["date"]),
        ]

    def __str__(self):
        return f"{self.loan} - {self.amount} MT ({self.date})"
