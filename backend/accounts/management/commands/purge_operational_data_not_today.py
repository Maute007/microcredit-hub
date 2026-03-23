"""
Remove dados operacionais com data anterior ao dia actual (TIME_ZONE do Django).

Mantém: utilizadores, papéis, perfis, SystemSettings, HRSettings, CompanyFinanceSettings,
impostos (Tax), categorias de empréstimo, colaboradores (Employee).

Remove (entre outros): clientes criados antes de hoje (cascade empréstimos/pagamentos/garantias),
empréstimos com início antes de hoje, pagamentos com data antes de hoje, transacções,
presenças, férias já terminadas antes de hoje, eventos de calendário custom, fechos mensais
de meses anteriores ao mês actual, recibos e lançamentos de folha de meses anteriores.

Uso:
  python manage.py purge_operational_data_not_today --confirm
  python manage.py purge_operational_data_not_today --confirm --dry-run
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone


class Command(BaseCommand):
    help = "Apaga dados operacionais anteriores ao dia actual (ver docstring do módulo)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Obrigatório para executar a limpeza.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Mostra contagens sem apagar.",
        )

    def handle(self, *args, **options):
        if not options["confirm"]:
            raise CommandError(
                "Esta operação apaga dados. Execute com --confirm (e faça backup antes)."
            )
        dry = options["dry_run"]
        cut = timezone.localdate()
        month_keep = cut.strftime("%Y-%m")

        from accounting.models import MonthlyFinanceSnapshot, MonthlySnapshotActionLog, Transaction
        from calendario.models import CalendarEvent
        from clients.models import Client
        from hr.models import AttendanceRecord, PayrollAdjustment, SalarySlip, Vacation
        from loans.models import Loan, Payment

        def report(qs, label: str) -> None:
            n = qs.count()
            if dry:
                self.stdout.write(self.style.WARNING(f"[dry-run] {label}: {n} registo(s)"))
            else:
                deleted, _details = qs.delete()
                self.stdout.write(
                    self.style.SUCCESS(
                        f"{label}: {deleted} objecto(s) removido(s) (cascatas incluídas)"
                    )
                )

        self.stdout.write(self.style.NOTICE(f"Data de corte (hoje): {cut} | mês a manter: {month_keep}"))

        with transaction.atomic():
            report(Transaction.objects.filter(date__lt=cut), "Transacções (data < hoje)")
            report(
                MonthlySnapshotActionLog.objects.exclude(snapshot_month=month_keep),
                "Auditoria de fechos (fora do mês actual)",
            )
            report(
                MonthlyFinanceSnapshot.objects.exclude(month=month_keep),
                "Fechos mensais financeiros (fora do mês actual)",
            )
            report(CalendarEvent.objects.filter(date__lt=cut), "Eventos de calendário custom (data < hoje)")
            report(AttendanceRecord.objects.filter(date__lt=cut), "Registos de presença (data < hoje)")
            report(Vacation.objects.filter(end_date__lt=cut), "Férias terminadas antes de hoje")
            report(SalarySlip.objects.exclude(month=month_keep), "Recibos de vencimento (outros meses)")
            report(
                PayrollAdjustment.objects.exclude(month=month_keep),
                "Lançamentos de folha (fora do mês actual)",
            )
            report(Payment.objects.filter(date__lt=cut), "Pagamentos (data < hoje)")
            report(Loan.objects.filter(start_date__lt=cut), "Empréstimos (início antes de hoje)")
            report(Client.objects.filter(created_at__date__lt=cut), "Clientes (criados antes de hoje)")

        if dry:
            self.stdout.write(self.style.WARNING("Dry-run: nada foi apagado."))
        else:
            self.stdout.write(self.style.SUCCESS("Limpeza concluída."))
