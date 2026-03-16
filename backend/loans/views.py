import calendar
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Q, Sum
from rest_framework import permissions
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from validators import MAX_PAGE_SIZE

from .models import Loan, LoanCategory, Payment
from .serializers import LoanCategorySerializer, LoanSerializer, PaymentSerializer
from .services import refresh_loan_statuses_batch


class LoanPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = MAX_PAGE_SIZE


class PaymentPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = "page_size"
    max_page_size = MAX_PAGE_SIZE


class LoanViewSet(ModelViewSet):
    serializer_class = LoanSerializer
    permission_classes = [permissions.DjangoModelPermissions]
    pagination_class = LoanPagination

    def get_queryset(self):
        refresh_loan_statuses_batch()  # Atualiza atrasados (quando data passa)
        qs = (
            Loan.objects.select_related("client")
            .prefetch_related("payments", "collateral")
            .annotate(
                _paid_amount=Sum(
                    "payments__amount",
                    filter=Q(payments__status="pago"),
                )
            )
        )
        status_filter = self.request.query_params.get("status")
        client_id = self.request.query_params.get("client")
        search = self.request.query_params.get("search", "").strip()
        ordering = self.request.query_params.get("ordering", "-start_date")

        if status_filter:
            qs = qs.filter(status=status_filter)
        if client_id:
            qs = qs.filter(client_id=client_id)
        if search:
            qs = qs.filter(
                Q(client__name__icontains=search) | Q(client__document__icontains=search)
            )

        if ordering.lstrip("-") in (
            "id",
            "amount",
            "total_amount",
            "start_date",
            "end_date",
            "status",
        ):
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by("-start_date")

        return qs

    @action(detail=True, methods=["get"], url_path="payments")
    def payments_list(self, request, pk=None):
        """Lista pagamentos do empréstimo."""
        loan = self.get_object()
        qs = Payment.objects.filter(loan=loan).select_related("loan__client").order_by("-date")
        serializer = PaymentSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="amortization")
    def amortization(self, request, pk=None):
        """Retorna tabela de amortização calculada."""
        loan = self.get_object()
        rows = []
        balance = float(loan.total_amount)
        rate = float(loan.interest_rate) / 100
        principal_per_month = float(loan.amount) / loan.term
        payments_by_installment = {
            p.installment_number: p for p in loan.payments.filter(status="pago")
        }
        today = date.today()

        for i in range(1, loan.term + 1):
            month = loan.start_date.month - 1 + i
            year = loan.start_date.year + (month // 12)
            month = (month % 12) + 1
            try:
                installment_date = loan.start_date.replace(year=year, month=month)
            except ValueError:
                last_day = calendar.monthrange(year, month)[1]
                installment_date = date(year, month, min(loan.start_date.day, last_day))

            interest = round(float(loan.amount) * rate / loan.term, 2)
            principal = round(principal_per_month, 2)
            payment_val = round(principal + interest, 2)
            balance = max(0, round(balance - payment_val, 2))

            paid = i in payments_by_installment
            overdue = not paid and installment_date < today
            status = "pago" if paid else ("atrasado" if overdue else "pendente")

            rows.append(
                {
                    "installment": i,
                    "date": str(installment_date),
                    "payment": payment_val,
                    "principal": principal,
                    "interest": interest,
                    "balance": balance,
                    "status": status,
                }
            )
        return Response(rows)


class LoanCategoryViewSet(ModelViewSet):
    serializer_class = LoanCategorySerializer
    permission_classes = [permissions.IsAdminUser]
    pagination_class = None

    @action(detail=False, methods=["get"], url_path="suggest", permission_classes=[permissions.IsAuthenticated])
    def suggest_by_amount(self, request):
        """Sugere categorias para um dado montante (min_amount <= amount <= max_amount)."""
        try:
            amount = Decimal(request.query_params.get("amount", 0))
        except (TypeError, ValueError):
            amount = Decimal("0")
        qs = LoanCategory.objects.filter(is_active=True).order_by("min_amount")
        matches = []
        for cat in qs:
            if amount < cat.min_amount:
                continue
            if cat.max_amount is not None and amount > cat.max_amount:
                continue
            matches.append(cat)
        serializer = LoanCategorySerializer(matches, many=True)
        return Response(serializer.data)

    def get_queryset(self):
        qs = LoanCategory.objects.all().order_by("name")
        active = self.request.query_params.get("is_active")
        if active is not None:
            qs = qs.filter(is_active=active.lower() in ("true", "1", "yes"))
        return qs


class PaymentViewSet(ModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.DjangoModelPermissions]
    pagination_class = PaymentPagination

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Resumo agregado para os cards da página de pagamentos (dados reais de empréstimos e pagamentos)."""
        today = date.today()
        this_month_start = today.replace(day=1)

        # Total recebido (todos os pagamentos com status pago)
        paid = Payment.objects.filter(status="pago")
        total_received = paid.aggregate(s=Sum("amount"))["s"] or Decimal("0")
        paid_count = paid.count()
        clients_paid = paid.values_list("loan__client_id", flat=True).distinct().count()

        # Este mês
        paid_this_month = Payment.objects.filter(
            date__gte=this_month_start,
            date__lte=today,
            status="pago",
        )
        received_this_month = paid_this_month.aggregate(s=Sum("amount"))["s"] or Decimal("0")
        received_this_month_count = paid_this_month.count()

        # Total pendente: saldo devedor dos empréstimos ativos e atrasados
        active_loans = Loan.objects.filter(status__in=["ativo", "atrasado"]).prefetch_related("payments")
        total_pending = Decimal("0")
        total_overdue = Decimal("0")
        overdue_loans_count = 0
        pending_clients_ids = set()
        overdue_clients_ids = set()
        for loan in active_loans:
            paid_sum = sum(
                float(p.amount or 0)
                for p in loan.payments.filter(status="pago")
            )
            remaining = float(loan.total_amount or 0) - paid_sum
            total_pending += Decimal(str(max(0, remaining)))
            if loan.client_id:
                pending_clients_ids.add(loan.client_id)
            if loan.status == "atrasado":
                total_overdue += Decimal(str(max(0, remaining)))
                overdue_loans_count += 1
                if loan.client_id:
                    overdue_clients_ids.add(loan.client_id)

        # Parcelas pendentes e atrasadas (contagem de Payment com esses status)
        pending_count = Payment.objects.filter(status="pendente").count()
        overdue_count = Payment.objects.filter(status="atrasado").count()
        # Se não houver Payment pendente/atrasado, estimar pelo número de empréstimos ativos
        if pending_count == 0 and overdue_count == 0:
            pending_count = sum(
                loan.term - loan.payments.filter(status="pago").count()
                for loan in active_loans
                if loan.status == "ativo"
            )
            overdue_count = sum(
                loan.term - loan.payments.filter(status="pago").count()
                for loan in active_loans
                if loan.status == "atrasado"
            )

        # Spark: últimos 7 meses recebidos
        spark_received = []
        for i in range(6, -1, -1):
            month_start = this_month_start
            for _ in range(i):
                month_start = (month_start.replace(day=1) - timedelta(days=1)).replace(day=1)
            last_day = calendar.monthrange(month_start.year, month_start.month)[1]
            month_end = month_start.replace(day=last_day)
            s = (
                Payment.objects.filter(
                    date__gte=month_start,
                    date__lte=month_end,
                    status="pago",
                ).aggregate(s=Sum("amount"))["s"]
                or Decimal("0")
            )
            spark_received.append(float(s))

        def _f(v):
            try:
                x = float(v or 0)
                return x if abs(x) != float("inf") and x == x else 0.0
            except (TypeError, ValueError):
                return 0.0

        return Response({
            "total_received": _f(total_received),
            "received_this_month": _f(received_this_month),
            "received_this_month_count": int(received_this_month_count),
            "paid_count": int(paid_count),
            "clients_paid_count": int(clients_paid),
            "total_pending": _f(total_pending),
            "total_overdue": _f(total_overdue),
            "pending_count": int(pending_count),
            "overdue_count": int(overdue_count),
            "overdue_loans_count": int(overdue_loans_count),
            "pending_clients_count": len(pending_clients_ids),
            "overdue_clients_count": len(overdue_clients_ids),
            "spark_received": spark_received,
        })

    def get_queryset(self):
        qs = Payment.objects.select_related("loan__client").order_by("-date")
        status_filter = self.request.query_params.get("status")
        loan_id = self.request.query_params.get("loan")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if loan_id:
            qs = qs.filter(loan_id=loan_id)
        return qs
