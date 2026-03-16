from decimal import Decimal

from django.db.models import Q, Sum
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination

from validators import MAX_PAGE_SIZE
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import Tax, Transaction
from .serializers import TaxSerializer, TransactionSerializer


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
