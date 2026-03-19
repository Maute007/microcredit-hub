import calendar as cal_module
from datetime import date
from decimal import Decimal

from django.db.models import Q, Sum
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination

from validators import MAX_PAGE_SIZE
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import (
    CompanyFinanceSettings,
    MonthlyFinanceSnapshot,
    MonthlySnapshotActionLog,
    Tax,
    Transaction,
)
from .serializers import (
    CompanyFinanceSettingsSerializer,
    MonthlyFinanceSnapshotSerializer,
    MonthlySnapshotActionLogSerializer,
    TaxSerializer,
    TransactionSerializer,
)
from loans.models import Loan, Payment
from hr.models import SalarySlip


class TransactionPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = "page_size"
    max_page_size = MAX_PAGE_SIZE


# Categorias comuns para o utilizador escolher (registos manuais)
COMMON_CATEGORIES = [
    "Pagamento Empréstimo",
    "Juros",
    "Desembolso",
    "Salários",
    "Aluguel",
    "Material",
    "Comunicações",
    "Transporte",
    "Seguro",
    "Outros",
]


class TransactionViewSet(ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.DjangoModelPermissions]
    pagination_class = TransactionPagination

    def get_queryset(self):
        qs = Transaction.objects.select_related("responsible", "loan").order_by("-date")
        type_filter = self.request.query_params.get("type")
        category = self.request.query_params.get("category", "").strip()
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        search = self.request.query_params.get("search", "").strip()
        ordering = self.request.query_params.get("ordering", "-date")
        if type_filter:
            qs = qs.filter(type=type_filter)
        if category:
            qs = qs.filter(category__icontains=category)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        if search:
            qs = qs.filter(
                Q(description__icontains=search) | Q(category__icontains=search)
            )
        if ordering.lstrip("-") in ("id", "amount", "date", "type", "category"):
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by("-date")
        return qs

    def perform_create(self, serializer):
        if not serializer.validated_data.get("responsible"):
            serializer.save(responsible=self.request.user)
        else:
            serializer.save()

    def _build_overview(self, date_from=None, date_to=None):
        tx_qs = Transaction.objects.all()
        if date_from:
            tx_qs = tx_qs.filter(date__gte=date_from)
        if date_to:
            tx_qs = tx_qs.filter(date__lte=date_to)
        tx_agg = tx_qs.aggregate(
            entradas=Sum("amount", filter=Q(type="entrada")),
            saidas=Sum("amount", filter=Q(type="saida")),
        )
        accounting_entries = float(tx_agg.get("entradas") or 0)
        accounting_exits = float(tx_agg.get("saidas") or 0)

        loans_qs = Loan.objects.all()
        if date_from:
            loans_qs = loans_qs.filter(start_date__gte=date_from)
        if date_to:
            loans_qs = loans_qs.filter(start_date__lte=date_to)
        loans_disbursed = float(loans_qs.aggregate(v=Sum("amount")).get("v") or 0)

        payments_qs = Payment.objects.filter(status="pago")
        if date_from:
            payments_qs = payments_qs.filter(date__gte=date_from)
        if date_to:
            payments_qs = payments_qs.filter(date__lte=date_to)
        payments_received = float(payments_qs.aggregate(v=Sum("amount")).get("v") or 0)

        payroll_qs = SalarySlip.objects.all()
        if date_from:
            payroll_qs = payroll_qs.filter(month__gte=str(date_from)[:7])
        if date_to:
            payroll_qs = payroll_qs.filter(month__lte=str(date_to)[:7])
        hr_payroll_paid = float(payroll_qs.aggregate(v=Sum("net_salary")).get("v") or 0)

        total_entries = accounting_entries + payments_received
        total_exits = accounting_exits + loans_disbursed + hr_payroll_paid
        settings_obj = CompanyFinanceSettings.get_solo()
        opening_balance = float(settings_obj.opening_balance or 0)
        real_balance = total_entries - total_exits
        consolidated_balance = opening_balance + real_balance

        open_loans = Loan.objects.filter(status__in=["ativo", "pendente", "atrasado"]).prefetch_related("payments")
        receivables_open = 0.0
        receivables_overdue = 0.0
        for loan in open_loans:
            paid_sum = float(
                loan.payments.filter(status="pago").aggregate(s=Sum("amount")).get("s") or 0
            )
            remaining = max(0.0, float(loan.total_amount or 0) - paid_sum)
            receivables_open += remaining
            if loan.status == "atrasado":
                receivables_overdue += remaining

        tx_future = Transaction.objects.filter(date__gt=date.today())
        if date_from:
            tx_future = tx_future.filter(date__gte=date_from)
        if date_to:
            tx_future = tx_future.filter(date__lte=date_to)
        tx_future_agg = tx_future.aggregate(
            scheduled_entries=Sum("amount", filter=Q(type="entrada")),
            scheduled_exits=Sum("amount", filter=Q(type="saida")),
        )
        scheduled_entries = float(tx_future_agg.get("scheduled_entries") or 0)
        scheduled_exits = float(tx_future_agg.get("scheduled_exits") or 0)

        return {
            "date_from": str(date_from) if date_from else None,
            "date_to": str(date_to) if date_to else None,
            "opening_balance": round(opening_balance, 2),
            "entries": {
                "accounting_entries": round(accounting_entries, 2),
                "payments_received": round(payments_received, 2),
                "total_entries": round(total_entries, 2),
            },
            "exits": {
                "accounting_exits": round(accounting_exits, 2),
                "loans_disbursed": round(loans_disbursed, 2),
                "hr_payroll_paid": round(hr_payroll_paid, 2),
                "total_exits": round(total_exits, 2),
            },
            "real_balance": round(real_balance, 2),
            "consolidated_balance": round(consolidated_balance, 2),
            "analysis": {
                "receivables_open": round(receivables_open, 2),
                "receivables_overdue": round(receivables_overdue, 2),
                "scheduled_entries": round(scheduled_entries, 2),
                "scheduled_exits": round(scheduled_exits, 2),
                "net_scheduled": round(scheduled_entries - scheduled_exits, 2),
            },
        }

    @action(detail=False, methods=["get"], url_path="balance")
    def balance(self, request):
        """
        Retorna saldo e totais por período.
        Query: date_from, date_to (opcional)
        """
        qs = Transaction.objects.all()
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        # Usamos o montante base para garantir que transacções antigas (sem total_amount preenchido)
        # também entram correctamente no cálculo.
        agg = qs.aggregate(
            total_entradas=Sum("amount", filter=Q(type="entrada")),
            total_saidas=Sum("amount", filter=Q(type="saida")),
        )
        entradas = float(agg.get("total_entradas") or 0)
        saidas = float(agg.get("total_saidas") or 0)
        saldo = entradas - saidas
        return Response(
            {
                "date_from": date_from,
                "date_to": date_to,
                "total_entradas": round(entradas, 2),
                "total_saidas": round(saidas, 2),
                "saldo": round(saldo, 2),
            }
        )

    @action(detail=False, methods=["get"], url_path="categories")
    def categories(self, request):
        """Lista categorias sugeridas + usadas nas transações."""
        used = (
            Transaction.objects.values_list("category", flat=True)
            .distinct()
            .order_by("category")
        )
        combined = sorted(set(COMMON_CATEGORIES) | set(used))
        return Response({"categories": combined})

    @action(detail=False, methods=["post"], url_path="simulate")
    def simulate(self, request):
        """
        Simula impacto de uma transação no saldo.
        Body: {"type": "entrada|saida", "amount": 1000, "date": "2025-03-15"}
        Não grava.
        """
        trans_type = request.data.get("type")
        amount = request.data.get("amount")
        date_val = request.data.get("date")
        if not trans_type or trans_type not in ("entrada", "saida"):
            return Response(
                {"detail": "type deve ser 'entrada' ou 'saida'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            amount = Decimal(str(amount))
        except (TypeError, ValueError):
            return Response(
                {"detail": "amount inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        qs = Transaction.objects.all()
        if date_val:
            qs = qs.filter(date__lte=date_val)
        agg = qs.aggregate(
            total_entradas=Sum("amount", filter=Q(type="entrada")),
            total_saidas=Sum("amount", filter=Q(type="saida")),
        )
        entradas = float(agg.get("total_entradas") or 0)
        saidas = float(agg.get("total_saidas") or 0)
        if trans_type == "entrada":
            entradas += float(amount)
        else:
            saidas += float(amount)
        saldo_projetado = entradas - saidas
        return Response(
            {
                "simulated": {"type": trans_type, "amount": float(amount), "date": date_val},
                "saldo_projetado": round(saldo_projetado, 2),
                "total_entradas_projetado": round(entradas, 2),
                "total_saidas_projetado": round(saidas, 2),
            }
        )

    @action(detail=False, methods=["get"], url_path="overview")
    def overview(self, request):
        """
        Visão financeira consolidada entre módulos.
        Query: date_from, date_to (opcional)
        """
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        return Response(self._build_overview(date_from=date_from, date_to=date_to))

    @action(detail=False, methods=["get", "patch"], url_path="finance-settings")
    def finance_settings(self, request):
        settings_obj = CompanyFinanceSettings.get_solo()
        if request.method == "GET":
            return Response(CompanyFinanceSettingsSerializer(settings_obj).data)
        if not request.user.has_perm("accounting.change_transaction"):
            return Response({"detail": "Sem permissão."}, status=status.HTTP_403_FORBIDDEN)
        serializer = CompanyFinanceSettingsSerializer(
            settings_obj, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=["get", "post"], url_path="monthly-snapshots")
    def monthly_snapshots(self, request):
        if request.method == "GET":
            qs = MonthlyFinanceSnapshot.objects.select_related("created_by").all().order_by("-month")
            return Response(MonthlyFinanceSnapshotSerializer(qs, many=True).data)

        if not request.user.has_perm("accounting.change_transaction"):
            return Response({"detail": "Sem permissão."}, status=status.HTTP_403_FORBIDDEN)

        month = (request.data.get("month") or "").strip()
        if len(month) != 7 or "-" not in month:
            return Response({"detail": "month inválido. Use YYYY-MM."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            year = int(month[:4])
            mon = int(month[5:7])
            first_day = date(year, mon, 1)
            last_day = date(year, mon, cal_module.monthrange(year, mon)[1])
        except (TypeError, ValueError):
            return Response({"detail": "month inválido. Use YYYY-MM."}, status=status.HTTP_400_BAD_REQUEST)

        if MonthlyFinanceSnapshot.objects.filter(month=month).exists():
            return Response({"detail": "Já existe fecho para este mês."}, status=status.HTTP_400_BAD_REQUEST)

        data = self._build_overview(date_from=first_day, date_to=last_day)
        snap = MonthlyFinanceSnapshot.objects.create(
            month=month,
            date_from=first_day,
            date_to=last_day,
            opening_balance=data["opening_balance"],
            total_entries=data["entries"]["total_entries"],
            total_exits=data["exits"]["total_exits"],
            real_balance=data["real_balance"],
            consolidated_balance=data["consolidated_balance"],
            created_by=request.user,
        )
        return Response(MonthlyFinanceSnapshotSerializer(snap).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path=r"monthly-snapshots/(?P<pk>[^/.]+)/reopen")
    def reopen_monthly_snapshot(self, request, pk=None):
        """Reabre (anula) um fecho mensal. Apenas staff/superuser, com motivo."""
        if not (request.user and (request.user.is_staff or request.user.is_superuser)):
            return Response({"detail": "Sem permissão."}, status=status.HTTP_403_FORBIDDEN)
        try:
            snap = MonthlyFinanceSnapshot.objects.get(pk=pk)
        except MonthlyFinanceSnapshot.DoesNotExist:
            return Response({"detail": "Fecho não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        reason = (request.data.get("reason") or "").strip()
        MonthlySnapshotActionLog.objects.create(
            snapshot_month=snap.month,
            action="reopen",
            reason=reason,
            user=request.user,
        )
        snap.delete()
        return Response({"detail": "Fecho reaberto."})

    @action(detail=False, methods=["get"], url_path="monthly-snapshot-audit")
    def monthly_snapshot_audit(self, request):
        """Lista auditoria de reaberturas/anulações."""
        qs = MonthlySnapshotActionLog.objects.select_related("user").all()[:200]
        return Response(MonthlySnapshotActionLogSerializer(qs, many=True).data)


class TaxViewSet(ModelViewSet):
    serializer_class = TaxSerializer
    permission_classes = [permissions.DjangoModelPermissions]
    pagination_class = None

    def get_queryset(self):
        qs = Tax.objects.all().order_by("name")
        active = self.request.query_params.get("is_active")
        if active is not None:
            qs = qs.filter(is_active=active.lower() in ("true", "1", "yes"))
        return qs
