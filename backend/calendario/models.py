from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class CalendarEvent(models.Model):
    """Evento custom (reunião, alerta, lembrete) no calendário."""

    TYPE_CHOICES = [
        ("meeting", _("Reunião")),
        ("alert", _("Alerta")),
        ("reminder", _("Lembrete")),
        ("other", _("Outro")),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="calendar_events",
        verbose_name=_("Utilizador"),
    )
    title = models.CharField(max_length=200, verbose_name=_("Título"))
    event_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default="other",
        verbose_name=_("Tipo"),
    )
    event_type_other = models.CharField(
        max_length=80,
        blank=True,
        verbose_name=_("Especificar tipo (quando Outro)"),
    )
    date = models.DateField(verbose_name=_("Data"))
    description = models.TextField(blank=True, verbose_name=_("Descrição"))
    notify = models.BooleanField(
        default=True,
        verbose_name=_("Enviar notificação"),
    )
    loan = models.ForeignKey(
        "loans.Loan",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="calendar_events",
        verbose_name=_("Empréstimo (opcional)"),
    )
    client_name = models.CharField(max_length=200, blank=True, verbose_name=_("Cliente"))
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_("Montante (MT)"),
    )
    color = models.CharField(
        max_length=20,
        blank=True,
        verbose_name=_("Cor (hex)"),
    )

    class Meta:
        verbose_name = _("Evento de calendário")
        verbose_name_plural = _("Eventos de calendário")
        ordering = ["date", "title"]
        indexes = [
            models.Index(fields=["user", "date"]),
            models.Index(fields=["date"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.date})"
