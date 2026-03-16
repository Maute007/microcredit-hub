from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords


class Tax(models.Model):
    """Imposto/Taxa (ex: IVA, INSS) para aplicar em transações."""

    SCOPE_CHOICES = [
        ("ambos", _("Entradas e Saídas")),
        ("entrada", _("Apenas Entradas")),
        ("saida", _("Apenas Saídas")),
    ]

    name = models.CharField(max_length=80, verbose_name=_("Nome"))
    code = models.CharField(max_length=30, unique=True, verbose_name=_("Código"))
    rate = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        default=0,
        verbose_name=_("Percentagem (0-1)"),
    )
    scope = models.CharField(
        max_length=20,
        choices=SCOPE_CHOICES,
        default="ambos",
        verbose_name=_("Aplicação"),
    )
    is_active = models.BooleanField(default=True, verbose_name=_("Activo"))
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Imposto")
        verbose_name_plural = _("Impostos")
        ordering = ["name"]
        indexes = [
            models.Index(fields=["is_active"]),
            models.Index(fields=["code"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Transaction(models.Model):
    """Transação financeira (entrada/saída)."""

    TYPE_CHOICES = [
        ("entrada", _("Entrada")),
        ("saida", _("Saída")),
    ]

    type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        verbose_name=_("Tipo"),
    )
    category = models.CharField(max_length=100, verbose_name=_("Categoria"))
    description = models.TextField(blank=True, verbose_name=_("Descrição"))
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        verbose_name=_("Montante"),
    )
    tax = models.ForeignKey(
        Tax,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions",
        verbose_name=_("Imposto"),
    )
    tax_rate = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        default=0,
        verbose_name=_("Taxa do imposto (snapshot)"),
    )
    tax_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_("Valor do imposto"),
    )
    total_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_("Total (base + imposto)"),
    )
    date = models.DateField(verbose_name=_("Data"))
    responsible = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accounting_transactions",
        verbose_name=_("Responsável"),
    )
    loan = models.ForeignKey(
        "loans.Loan",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions",
        verbose_name=_("Empréstimo"),
    )
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Transação")
        verbose_name_plural = _("Transações")
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["type"]),
            models.Index(fields=["date"]),
            models.Index(fields=["category"]),
        ]

    def __str__(self):
        return f"{self.type} - {self.category} - {self.total_amount or self.amount} MT"

    def save(self, *args, **kwargs):
        from decimal import Decimal

        base = Decimal(str(self.amount or 0))
        rate = Decimal(str(self.tax_rate or 0))
        if self.tax and (self.tax_rate is None or Decimal(str(self.tax_rate)) == Decimal("0")):
            rate = Decimal(str(self.tax.rate or 0))
            self.tax_rate = rate
        tax_amount = (base * rate).quantize(Decimal("0.01"))
        self.tax_amount = tax_amount
        self.total_amount = (base + tax_amount).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)
