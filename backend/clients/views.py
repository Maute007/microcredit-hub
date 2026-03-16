from django.db.models import Count, Q
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination

from validators import MAX_PAGE_SIZE
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import Client
from .serializers import ClientSerializer


class ClientPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = MAX_PAGE_SIZE


class ClientViewSet(ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [permissions.DjangoModelPermissions]
    pagination_class = ClientPagination

    def get_queryset(self):
        qs = Client.objects.annotate(_total_loans=Count("loans"))
        search = self.request.query_params.get("search", "").strip()
        status_filter = self.request.query_params.get("status")
        city = self.request.query_params.get("city", "").strip()
        ordering = self.request.query_params.get("ordering", "name")

        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(email__icontains=search)
                | Q(document__icontains=search)
                | Q(phone__icontains=search)
                | Q(address__icontains=search)
                | Q(occupation__icontains=search)
            )
        if status_filter:
            qs = qs.filter(status=status_filter)
        if city:
            qs = qs.filter(city__icontains=city)

        if ordering.lstrip("-") in ("id", "name", "email", "city", "status", "created_at"):
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by("name")

        return qs

    @action(detail=True, methods=["get"], url_path="loans")
    def loans(self, request, pk=None):
        """Lista empréstimos do cliente."""
        client = self.get_object()
        from django.db.models import Sum, Q

        from loans.models import Loan
        from loans.serializers import LoanSerializer

        loans_qs = (
            Loan.objects.filter(client=client)
            .select_related("client")
            .prefetch_related("payments")
            .annotate(
                _paid_amount=Sum(
                    "payments__amount",
                    filter=Q(payments__status="pago"),
                )
            )
            .order_by("-start_date")
        )
        serializer = LoanSerializer(loans_qs, many=True)
        return Response(serializer.data)
