from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords


class HRSettings(models.Model):
    """
    Configurações globais de RH (singleton).

    - weekend_days: lista de inteiros [0..6] onde 0=Seg e 6=Dom.
    - workday_start/end: horário padrão para dias úteis.
    - weekend_start/end: horário padrão para fins-de-semana (caso haja trabalho).
    """

    weekend_days = models.JSONField(default=list, verbose_name=_("Dias de fim‑de‑semana"))
    workday_start = models.TimeField(default="08:00", verbose_name=_("Entrada (dias úteis)"))
    workday_end = models.TimeField(default="17:00", verbose_name=_("Saída (dias úteis)"))
    weekend_start = models.TimeField(default="08:00", verbose_name=_("Entrada (fim‑de‑semana)"))
    weekend_end = models.TimeField(default="13:00", verbose_name=_("Saída (fim‑de‑semana)"))
    auto_fill_attendance = models.BooleanField(
        default=True, verbose_name=_("Auto-preencher presenças em falta (ausente)")
    )

    # Políticas de presença (mundo real)
    late_grace_minutes = models.PositiveIntegerField(
        default=10, verbose_name=_("Tolerância de atraso (min)"),
        help_text=_("Minutos de tolerância após a hora de entrada."),
    )
    good_hours_ratio = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        default=0.90,
        verbose_name=_("Semáforo horas: Verde (ratio)"),
    )
    ok_hours_ratio = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        default=0.75,
        verbose_name=_("Semáforo horas: Amarelo (ratio)"),
    )
    auto_detect_late = models.BooleanField(
        default=True, verbose_name=_("Detectar atraso automaticamente"),
        help_text=_("Marca como 'atrasado' quando check_in ultrapassa a entrada + tolerância."),
    )

    class Meta:
        verbose_name = _("Configuração de RH")
        verbose_name_plural = _("Configurações de RH")

    def __str__(self):
        return "Configurações de RH"

    @classmethod
    def get_solo(cls):
        obj = cls.objects.first()
        if obj:
            return obj
        # default: sábado e domingo
        return cls.objects.create(weekend_days=[5, 6])


class Employee(models.Model):
    """Colaborador (pode ou não estar ligado a User)."""

    STATUS_CHOICES = [
        ("ativo", _("Ativo")),
        ("inativo", _("Inativo")),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employee",
        verbose_name=_("Utilizador"),
    )
    name = models.CharField(max_length=200, verbose_name=_("Nome"))
    role = models.CharField(max_length=100, verbose_name=_("Cargo"))
    department = models.CharField(max_length=100, blank=True, verbose_name=_("Departamento"))
    base_salary = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_("Salário base"),
    )
    phone = models.CharField(max_length=30, blank=True, verbose_name=_("Telefone"))
    email = models.EmailField(blank=True, verbose_name=_("E-mail"))
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="ativo",
        verbose_name=_("Estado"),
    )
    hire_date = models.DateField(null=True, blank=True, verbose_name=_("Data de admissão"))
    color = models.CharField(max_length=20, blank=True, verbose_name=_("Cor (calendário)"))

    # --- Políticas / taxas configuráveis ---
    inss_rate = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        default=0.03,
        verbose_name=_("Taxa INSS (0-1)"),
    )
    irps_rate = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        default=0.10,
        verbose_name=_("Taxa IRPS (0-1)"),
    )
    other_deductions_rate = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        default=0.01,
        verbose_name=_("Outras deduções (0-1)"),
    )
    overtime_rate_default = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        default=0.00,
        verbose_name=_("Horas extra padrão (0-1 do salário base)"),
    )
    penalty_absent_rate = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        default=0.00,
        verbose_name=_("Penalização por falta (0-1 por ocorrência)"),
    )
    penalty_late_rate = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        default=0.00,
        verbose_name=_("Penalização por atraso (0-1 por ocorrência)"),
    )
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Colaborador")
        verbose_name_plural = _("Colaboradores")
        ordering = ["name"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["department"]),
        ]

    def __str__(self):
        return self.name


class Vacation(models.Model):
    """Férias do colaborador."""

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="vacations",
        verbose_name=_("Colaborador"),
    )
    start_date = models.DateField(verbose_name=_("Data início"))
    end_date = models.DateField(verbose_name=_("Data fim"))
    color = models.CharField(max_length=20, blank=True, verbose_name=_("Cor"))
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Férias")
        verbose_name_plural = _("Férias")
        ordering = ["-start_date"]
        indexes = [
            models.Index(fields=["employee"]),
            models.Index(fields=["start_date", "end_date"]),
        ]


class AttendanceRecord(models.Model):
    """Registo de ponto."""

    STATUS_CHOICES = [
        ("presente", _("Presente")),
        ("ausente", _("Ausente")),
        ("atrasado", _("Atrasado")),
        ("ferias", _("Férias")),
        ("justificado", _("Justificado")),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="attendance_records",
        verbose_name=_("Colaborador"),
    )
    date = models.DateField(verbose_name=_("Data"))
    check_in = models.TimeField(null=True, blank=True, verbose_name=_("Entrada"))
    check_out = models.TimeField(null=True, blank=True, verbose_name=_("Saída"))
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="presente",
        verbose_name=_("Estado"),
    )
    hours_worked = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=0,
        verbose_name=_("Horas trabalhadas"),
    )
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Registo de ponto")
        verbose_name_plural = _("Registos de ponto")
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["employee", "date"]),
        ]


class SalarySlip(models.Model):
    """Recibo de vencimento."""

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="salary_slips",
        verbose_name=_("Colaborador"),
    )
    month = models.CharField(max_length=7, verbose_name=_("Mês (YYYY-MM)"))
    base_salary = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_("Salário base"),
    )
    overtime = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_("Horas extras"),
    )
    bonus = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_("Bónus"),
    )
    gross_salary = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_("Salário bruto"),
    )
    inss = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_("INSS"),
    )
    irps = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_("IRPS"),
    )
    other_deductions = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_("Outras deduções"),
    )
    total_deductions = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_("Total deduções"),
    )
    net_salary = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_("Salário líquido"),
    )
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Recibo de vencimento")
        verbose_name_plural = _("Recibos de vencimento")
        ordering = ["-month"]
        unique_together = [["employee", "month"]]
        indexes = [
            models.Index(fields=["employee", "month"]),
        ]


class PayrollAdjustment(models.Model):
    """Lançamentos mensais (extras, bónus e descontos manuais) por colaborador."""

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="payroll_adjustments",
        verbose_name=_("Colaborador"),
    )
    month = models.CharField(max_length=7, verbose_name=_("Mês (YYYY-MM)"))
    date = models.DateField(null=True, blank=True, verbose_name=_("Data do lançamento"))
    overtime = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_("Horas extra (valor)"),
    )
    bonus = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_("Bónus (valor)"),
    )
    other_deductions_manual = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_("Outros descontos (manual)"),
    )
    notes = models.CharField(max_length=255, blank=True, verbose_name=_("Notas"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _("Lançamento de folha")
        verbose_name_plural = _("Lançamentos de folha")
        ordering = ["-month", "employee_id"]
        indexes = [
            models.Index(fields=["month"]),
            models.Index(fields=["employee", "month"]),
        ]

    def __str__(self):
        return f"{self.employee} - {self.month}"
