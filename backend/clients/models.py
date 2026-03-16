from django.db import models
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords


class Client(models.Model):
    """Cliente do microcrédito."""

    STATUS_CHOICES = [
        ("ativo", _("Ativo")),
        ("inativo", _("Inativo")),
    ]

    name = models.CharField(max_length=200, verbose_name=_("Nome"))
    email = models.EmailField(blank=True, verbose_name=_("E-mail"))
    phone = models.CharField(max_length=30, blank=True, verbose_name=_("Telefone"))
    document = models.CharField(max_length=50, blank=True, verbose_name=_("Documento"))
    address = models.TextField(blank=True, verbose_name=_("Morada"))
    city = models.CharField(max_length=100, blank=True, verbose_name=_("Cidade"))
    occupation = models.CharField(max_length=100, blank=True, verbose_name=_("Profissão"))
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="ativo",
        verbose_name=_("Estado"),
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Criado em"))
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Cliente")
        verbose_name_plural = _("Clientes")
        ordering = ["name"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["document"]),
            models.Index(fields=["email"]),
        ]

    def __str__(self):
        return self.name
