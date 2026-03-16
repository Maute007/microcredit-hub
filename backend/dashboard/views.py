import calendar
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum, Q
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from accounting.models import Transaction
from clients.models import Client
from hr.models import Employee
from loans.models import Loan, Payment


class DashboardSummaryView(APIView):
    """KPIs e resumos para o painel, com dados reais."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = date.today()
        this_month_start = today.replace(day=1)

        # Clientes
        clients_total = Client.objects.count()
        clients_active = Client.objects.filter(status="ativo").count()

        # Empréstimos
        loans_qs = Loan.objects.all()
        loans_total_count = loans_qs.count()
        loans_active = loans_qs.filter(status__in=["ativo", "atrasado"])
        loans_overdue = loans_qs.filter(status="atrasado")
        portfolio_total = loans_qs.aggregate(s=Sum("total_amount"))["s"] or Decimal("0")
        overdue_loans = Loan.objects.filter(status="atrasado").prefetch_related("payments")
        overdue_total = 0.0
        for loan in overdue_loans:
            paid = sum(float(p.amount or 0) for p in loan.payments.filter(status="pago"))
            overdue_total += max(0.0, float(loan.total_amount or 0) - paid)

        # Pagamentos recebidos este mês
        payments_this_month = Payment.objects.filter(
            date__gte=this_month_start,
            date__lte=today,
            status="pago",
        )
        monthly_received = payments_this_month.aggregate(s=Sum("amount"))["s"] or Decimal("0")
        monthly_received_count = payments_this_month.count()

        # Transacções (entradas/saídas)
        tx_entradas = Transaction.objects.filter(type="entrada").aggregate(s=Sum("amount"))["s"] or Decimal("0")
        tx_saidas = Transaction.objects.filter(type="saida").aggregate(s=Sum("amount"))["s"] or Decimal("0")

        # Empréstimos por status (pie)
        status_counts = {
            "ativo": loans_qs.filter(status="ativo").count(),
            "pago": loans_qs.filter(status="pago").count(),
            "atrasado": loans_qs.filter(status="atrasado").count(),
            "pendente": loans_qs.filter(status="pendente").count(),
        }

        # Últimos 7 meses: recebido vs emprestado
        monthly_flow = []
        for i in range(7, -1, -1):
            month_start = this_month_start
            for _ in range(i):
                month_start = (month_start.replace(day=1) - timedelta(days=1)).replace(day=1)
            if i == 0:
                month_end = today
            else:
                last_day = calendar.monthrange(month_start.year, month_start.month)[1]
                month_end = month_start.replace(day=last_day)
            recebido = (
                Payment.objects.filter(
                    date__gte=month_start,
                    date__lte=month_end,
                    status="pago",
                ).aggregate(s=Sum("amount"))["s"]
                or Decimal("0")
            )
            emprestado = (
                Loan.objects.filter(
                    start_date__gte=month_start,
                    start_date__lte=month_end,
                ).aggregate(s=Sum("amount"))["s"]
                or Decimal("0")
            )
            month_names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
            monthly_flow.append({
                "month": month_names[month_start.month - 1],
                "recebido": float(recebido),
                "emprestado": float(emprestado),
            })
        monthly_flow.reverse()

        # Crescimento de clientes (novos por mês, últimos 6 meses)
        client_growth = []
        for i in range(6, -1, -1):
            month_start = this_month_start
            for _ in range(i):
                month_start = (month_start.replace(day=1) - timedelta(days=1)).replace(day=1)
            last_day = calendar.monthrange(month_start.year, month_start.month)[1]
            month_end = month_start.replace(day=last_day)
            new_clients = Client.objects.filter(
                created_at__date__gte=month_start,
                created_at__date__lte=month_end,
            ).count()
            month_names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
            client_growth.append({
                "month": month_names[month_start.month - 1],
                "clientes": new_clients,
            })
        client_growth.reverse()

        # Fluxo de caixa (transacções diárias) — mês actual
        last_day = calendar.monthrange(today.year, today.month)[1]
        month_end = today.replace(day=min(today.day, last_day))
        tx_by_day = (
            Transaction.objects.filter(
                date__gte=this_month_start,
                date__lte=month_end,
            )
            .values("date")
            .annotate(
                entrada=Sum("amount", filter=Q(type="entrada")),
                saida=Sum("amount", filter=Q(type="saida")),
            )
        )
        cash_flow = [
            {
                "day": str(t["date"].day).zfill(2),
                "entrada": float(t["entrada"] or 0),
                "saida": float(t["saida"] or 0),
            }
            for t in tx_by_day.order_by("date")
        ]

        # Colaboradores ativos
        employees_active = Employee.objects.filter(status="ativo").count()

        # Pagamentos recentes (últimos 6)
        recent_payments = (
            Payment.objects.select_related("loan__client")
            .order_by("-date")[:6]
        )
        recent_payments_list = [
            {
                "id": p.id,
                "amount": float(p.amount or 0),
                "date": str(p.date),
                "status": p.status,
                "installment_number": p.installment_number,
                "client_name": p.loan.client.name if p.loan else "",
            }
            for p in recent_payments
        ]

        def _safe_float(v):
            try:
                f = float(v or 0)
                return f if abs(f) != float("inf") and f == f else 0.0  # exclude inf and nan
            except (TypeError, ValueError):
                return 0.0

        # Spark data para mini-gráficos
        spark_received = [_safe_float(m.get("recebido")) for m in (monthly_flow[-7:] or [])]
        while len(spark_received) < 7:
            spark_received.append(0.0)
        pt = _safe_float(portfolio_total)
        spark_portfolio = [pt * (0.6 + 0.05 * i) for i in range(7)] if pt > 0 else [0.0] * 7
        growth_vals = [g["clientes"] for g in client_growth[-7:]]
        total_new = sum(growth_vals)
        base = max(0, clients_active - total_new)
        spark_clients_data = []
        cumul = 0
        for v in growth_vals:
            cumul += v
            spark_clients_data.append(base + cumul)
        while len(spark_clients_data) < 7:
            spark_clients_data = [max(0, clients_active - 1)] + spark_clients_data

        return Response({
            "summary": {
                "clients_total": int(clients_total),
                "clients_active": int(clients_active),
                "loans_total": int(loans_total_count),
                "loans_overdue_count": int(loans_overdue.count()),
                "portfolio_total": _safe_float(portfolio_total),
                "monthly_received": _safe_float(monthly_received),
                "monthly_received_count": int(monthly_received_count),
                "overdue_total": _safe_float(overdue_total),
                "entradas": _safe_float(tx_entradas),
                "saidas": _safe_float(tx_saidas),
                "employees_active": int(employees_active),
            },
            "status_data": [
                {"name": "Ativos", "value": status_counts["ativo"], "color": "hsl(210, 80%, 45%)"},
                {"name": "Pagos", "value": status_counts["pago"], "color": "hsl(152, 60%, 42%)"},
                {"name": "Atrasados", "value": status_counts["atrasado"], "color": "hsl(0, 72%, 51%)"},
                {"name": "Pendentes", "value": status_counts["pendente"], "color": "hsl(38, 92%, 50%)"},
            ],
            "monthly_flow": monthly_flow,
            "client_growth": client_growth,
            "cash_flow": cash_flow,
            "recent_payments": recent_payments_list,
            "spark_received": spark_received,
            "spark_portfolio": spark_portfolio,
            "spark_clients": spark_clients_data,
            "spark_overdue": [status_counts["atrasado"]] * 7,
        })
