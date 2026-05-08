from datetime import date as date_type

from django.http import HttpResponse
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .bom_export import generate_bom_report


REPORTS_METADATA = [
    {
        "id": "clientes",
        "title": "Relatório de Clientes",
        "description": "Lista completa com dados pessoais, status e estado da dívida de cada cliente",
        "type": "clients",
        "export_formats": ["csv", "pdf"],
        "filters": [],
    },
    {
        "id": "emprestimos",
        "title": "Relatório de Empréstimos",
        "description": "Todos os empréstimos com valores, parcelas, juros e status actualizado",
        "type": "loans",
        "export_formats": ["csv", "pdf"],
        "filters": ["status"],
    },
    {
        "id": "pagamentos",
        "title": "Relatório de Pagamentos",
        "description": "Histórico detalhado de todos os pagamentos, incluindo método e comprovativo",
        "type": "payments",
        "export_formats": ["csv", "pdf"],
        "filters": ["status", "date_from", "date_to"],
    },
    {
        "id": "financeiro",
        "title": "Relatório Financeiro",
        "description": "Resumo de entradas, saídas, fluxo de caixa e balanço geral da empresa",
        "type": "accounting",
        "export_formats": ["csv", "pdf"],
        "filters": ["date_from", "date_to", "type"],
    },
    {
        "id": "rh",
        "title": "Relatório de RH",
        "description": "Dados de colaboradores, férias programadas e folha salarial com descontos",
        "type": "hr",
        "export_formats": ["csv", "pdf"],
        "filters": ["status"],
    },
    {
        "id": "inadimplencia",
        "title": "Relatório de Inadimplência",
        "description": "Clientes com empréstimos em atraso, valores devidos e histórico de cobranças",
        "type": "overdue",
        "export_formats": ["csv", "pdf"],
        "filters": [],
    },
]


class ReportsListView(APIView):
    """Lista os relatórios disponíveis com metadados (título, descrição, tipo, formatos de exportação)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({"reports": REPORTS_METADATA})


class BomReportExportView(APIView):
    """Gera e devolve o relatório BdM (Ficha de Reporte Trimestral) em formato Excel."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from accounts.models import SystemSettings
        from loans.models import Loan, Payment
        from clients.models import Client

        date_from_str = request.query_params.get("date_from", "")
        date_to_str = request.query_params.get("date_to", "")
        period_label = request.query_params.get("period_label", "")

        try:
            date_from = date_type.fromisoformat(date_from_str) if date_from_str else date_type(date_type.today().year, date_type.today().month, 1)
            date_to = date_type.fromisoformat(date_to_str) if date_to_str else date_type.today()
        except ValueError:
            date_from = date_type(date_type.today().year, date_type.today().month, 1)
            date_to = date_type.today()

        if not period_label:
            period_label = date_from.strftime("%B de %Y").capitalize()

        settings = SystemSettings.get_solo()

        xlsx_bytes = generate_bom_report(
            settings=settings,
            loans_qs=Loan.objects.select_related("client", "category").prefetch_related("payments"),
            payments_qs=Payment.objects.select_related("loan"),
            clients_qs=Client.objects.all(),
            date_from=date_from,
            date_to=date_to,
            period_label=period_label,
        )

        filename = f"reporte_bom_{date_from.strftime('%Y_%m')}.xlsx"
        response = HttpResponse(
            xlsx_bytes,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class ParMetricsView(APIView):
    """PAR30 / PAR60 / PAR90 portfolio-at-risk metrics."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from loans.models import Loan, Payment
        from django.db.models import Sum, Count
        from decimal import Decimal
        from datetime import date, timedelta

        today = date.today()
        active_loans = Loan.objects.filter(status__in=["ativo", "atrasado"])
        total_portfolio = active_loans.aggregate(s=Sum("amount"))["s"] or Decimal("0")
        total_count = active_loans.count()

        def par(min_days):
            ids = set(
                Payment.objects.filter(status="atrasado")
                .filter(date__lte=today - timedelta(days=min_days))
                .values_list("loan_id", flat=True)
            )
            if not ids:
                return Decimal("0"), 0
            qs = Loan.objects.filter(id__in=ids)
            return qs.aggregate(s=Sum("amount"))["s"] or Decimal("0"), qs.count()

        par30_v, par30_c = par(30)
        par60_v, par60_c = par(60)
        par90_v, par90_c = par(90)
        ratio = lambda v: round(float(v / total_portfolio * 100), 2) if total_portfolio else 0.0

        due_soon = Payment.objects.filter(
            status="pendente", date__gte=today, date__lte=today + timedelta(days=7)
        ).aggregate(s=Sum("amount"), c=Count("id"))

        overdue_agg = Payment.objects.filter(status="atrasado").aggregate(
            s=Sum("amount"), c=Count("id")
        )

        return Response({
            "total_portfolio": float(total_portfolio),
            "total_active_loans": total_count,
            "par30": {"amount": float(par30_v), "count": par30_c, "ratio": ratio(par30_v)},
            "par60": {"amount": float(par60_v), "count": par60_c, "ratio": ratio(par60_v)},
            "par90": {"amount": float(par90_v), "count": par90_c, "ratio": ratio(par90_v)},
            "due_this_week": {"amount": float(due_soon["s"] or 0), "count": due_soon["c"] or 0},
            "overdue": {"amount": float(overdue_agg["s"] or 0), "count": overdue_agg["c"] or 0},
        })
