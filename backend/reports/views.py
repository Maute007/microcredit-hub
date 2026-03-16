from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView


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
