import calendar as cal_module
from datetime import date, timedelta
from decimal import Decimal

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from hr.models import Vacation
from loans.models import Loan

from accounts.permissions import user_has_permission

from .models import CalendarEvent
from .serializers import CalendarEventSerializer


class CanViewCalendario(permissions.BasePermission):
    """Exige view_calendarevent para leitura do calendário."""

    def has_permission(self, request, view):
        return user_has_permission(request.user, "calendario.view_calendarevent")


class CalendarioCRUDPermissions(permissions.BasePermission):
    """Permissões CRUD para eventos do calendário (view/add/change/delete_calendarevent)."""

    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return user_has_permission(request.user, "calendario.view_calendarevent")
        if request.method == "POST":
            return user_has_permission(request.user, "calendario.add_calendarevent")
        if request.method in ("PUT", "PATCH"):
            return user_has_permission(request.user, "calendario.change_calendarevent")
        if request.method == "DELETE":
            return user_has_permission(request.user, "calendario.delete_calendarevent")
        return False


def _amortization_dates_for_loan(loan, start_date, end_date):
    """Gera datas de vencimento para um empréstimo no intervalo [start_date, end_date]."""
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
            last_day = cal_module.monthrange(year, month)[1]
            installment_date = date(
                year, month, min(loan.start_date.day, last_day)
            )

        if not (start_date <= installment_date <= end_date):
            continue

        interest = round(float(loan.amount) * rate / loan.term, 2)
        principal = round(principal_per_month, 2)
        payment_val = round(principal + interest, 2)
        balance = max(0, round(balance - payment_val, 2))

        paid = i in payments_by_installment
        overdue = not paid and installment_date < today
        evt_type = "overdue" if overdue else ("payment" if not paid else None)
        if evt_type is None:
            continue  # já pago, não mostrar

        rows.append({
            "id": f"loan-{loan.id}-inst-{i}",
            "title": f"{'ATRASO - ' if overdue else 'Pagamento '}{loan.client.name}",
            "date": str(installment_date),
            "type": evt_type,
            "client_name": loan.client.name,
            "amount": payment_val,
            "loan_id": loan.id,
            "installment_number": i,
        })
    return rows


class CalendarEventsView(APIView):
    """Eventos agregados: vencimentos (loans), férias (hr), eventos custom."""

    permission_classes = [CanViewCalendario]

    def get(self, request):
        year = request.query_params.get("year")
        month = request.query_params.get("month")
        today = date.today()
        if year and month:
            try:
                y, m = int(year), int(month)
                start_date = date(y, m, 1)
                _, last = cal_module.monthrange(y, m)
                end_date = date(y, m, last)
            except (ValueError, TypeError):
                start_date = date(today.year, today.month, 1)
                _, last = cal_module.monthrange(today.year, today.month)
                end_date = date(today.year, today.month, last)
        else:
            # Sem filtro: próximo e anterior mês
            start_date = date(today.year, today.month - 1, 1)
            _, last = cal_module.monthrange(today.year, today.month + 1)
            end_date = date(today.year, today.month + 1, last)

        events = []

        # 1. Vencimentos de empréstimos (ativos, pendentes, atrasados)
        loans = (
            Loan.objects.filter(status__in=["ativo", "pendente", "atrasado"])
            .select_related("client")
            .prefetch_related("payments")
        )
        for loan in loans:
            events.extend(
                _amortization_dates_for_loan(loan, start_date, end_date)
            )

        # 2. Férias
        vacations = Vacation.objects.filter(
            start_date__lte=end_date,
            end_date__gte=start_date,
        ).select_related("employee")
        for v in vacations:
            d = max(v.start_date, start_date)
            end_vac = min(v.end_date, end_date)
            while d <= end_vac:
                events.append({
                    "id": f"vac-{v.id}-{d}",
                    "title": f"Férias - {v.employee.name}",
                    "date": str(d),
                    "type": "vacation",
                    "employee_name": v.employee.name,
                    "color": v.color or "",
                })
                d = d + timedelta(days=1)

        # 3. Eventos custom do utilizador
        custom = CalendarEvent.objects.filter(
            user=request.user,
            date__gte=start_date,
            date__lte=end_date,
        ).select_related("loan")
        for e in custom:
            evt_type = e.event_type
            evt = {
                "id": f"evt-{e.id}",
                "title": e.title,
                "date": str(e.date),
                "type": evt_type,
                "type_label": (e.event_type_other or "").strip() or None,
                "description": e.description,
                "client_name": e.client_name or (e.loan.client.name if e.loan else ""),
                "amount": float(e.amount) if e.amount else None,
                "color": (e.color or "").strip() or None,
            }
            events.append(evt)

        return Response({"events": events})


class CalendarEventViewSet(APIView):
    """CRUD para eventos custom (alternativa ao ModelViewSet para manter urls simples)."""

    permission_classes = [CalendarioCRUDPermissions]

    def get_queryset(self):
        return CalendarEvent.objects.filter(user=self.request.user)

    def get(self, request):
        qs = self.get_queryset().order_by("date")
        serializer = CalendarEventSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CalendarEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CalendarEventDetailView(APIView):
    permission_classes = [CalendarioCRUDPermissions]

    def get_object(self, pk):
        return CalendarEvent.objects.get(pk=pk, user=self.request.user)

    def patch(self, request, pk):
        try:
            obj = self.get_object(pk)
        except CalendarEvent.DoesNotExist:
            return Response({"detail": "Não encontrado."}, status=404)
        serializer = CalendarEventSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        try:
            obj = self.get_object(pk)
        except CalendarEvent.DoesNotExist:
            return Response(status=404)
        obj.delete()
        return Response(status=204)


class NotificationsView(APIView):
    """Notificações: pagamentos atrasados, próximos vencimentos, alertas. Qualquer autenticado vê."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = date.today()
        notifications = []

        # Empréstimos atrasados e próximos vencimentos
        loans = (
            Loan.objects.filter(status__in=["ativo", "pendente", "atrasado"])
            .select_related("client", "category")
            .prefetch_related("payments")
        )
        for loan in loans:
            paid_installments = {
                p.installment_number
                for p in loan.payments.filter(status="pago")
            }
            first_overdue_date = None
            for i in range(1, loan.term + 1):
                if i in paid_installments:
                    continue
                month = loan.start_date.month - 1 + i
                year = loan.start_date.year + (month // 12)
                month = (month % 12) + 1
                try:
                    due_date = loan.start_date.replace(year=year, month=month)
                except ValueError:
                    last_day = cal_module.monthrange(year, month)[1]
                    due_date = date(
                        year, month, min(loan.start_date.day, last_day)
                    )
                rate = float(loan.interest_rate) / 100
                principal = float(loan.amount) / loan.term
                interest = float(loan.amount) * rate / loan.term
                amount = round(principal + interest, 2)

                if due_date < today:
                    if first_overdue_date is None:
                        first_overdue_date = due_date
                    notifications.append({
                        "id": f"overdue-{loan.id}-{i}",
                        "type": "overdue",
                        "title": f"Pagamento em atraso: {loan.client.name}",
                        "date": str(due_date),
                        "client_name": loan.client.name,
                        "amount": amount,
                        "loan_id": loan.id,
                        "installment_number": i,
                    })
                elif (due_date - today).days <= 7:
                    notifications.append({
                        "id": f"upcoming-{loan.id}-{i}",
                        "type": "upcoming",
                        "title": f"Vencimento em {(due_date - today).days} dias: {loan.client.name}",
                        "date": str(due_date),
                        "client_name": loan.client.name,
                        "amount": amount,
                        "loan_id": loan.id,
                        "installment_number": i,
                    })

            # Risco de perda de garantia (quando atraso aproxima collateral_grace_days)
            if first_overdue_date and loan.category:
                grace = loan.category.collateral_grace_days or 60
                days_overdue = (today - first_overdue_date).days
                if days_overdue >= max(0, grace - 7):
                    notifications.append({
                        "id": f"collateral-risk-{loan.id}",
                        "type": "collateral_risk",
                        "title": f"Risco de perda de garantia: {loan.client.name}",
                        "date": str(first_overdue_date),
                        "client_name": loan.client.name,
                        "amount": None,
                        "loan_id": loan.id,
                        "description": f"Atraso de {days_overdue} dias. Tolerância: {grace} dias.",
                    })

        # Alertas custom (próximos 7 dias)
        # Eventos custom com notificação (próximos 7 dias)
        custom = CalendarEvent.objects.filter(
            user=request.user,
            notify=True,
            date__gte=today,
            date__lte=today + timedelta(days=7),
        ).order_by("date")[:25]
        for e in custom:
            evt_type = e.event_type if e.event_type in ["alert", "reminder", "meeting"] else "other"
            notifications.append({
                "id": f"evt-{e.id}",
                "type": evt_type,
                "title": e.title,
                "date": str(e.date),
                "client_name": e.client_name,
                "amount": float(e.amount) if e.amount else None,
                "description": e.description,
            })

        # Novo empréstimo (opcional, para audit) — empréstimos iniciados nos últimos 7 dias
        week_ago = today - timedelta(days=7)
        new_loans = Loan.objects.filter(
            start_date__gte=week_ago,
            status__in=["ativo", "pendente"],
        ).select_related("client")[:25]
        for loan in new_loans:
            notifications.append({
                "id": f"new-loan-{loan.id}",
                "type": "new_loan",
                "title": f"Novo empréstimo: {loan.client.name}",
                "date": str(loan.start_date),
                "client_name": loan.client.name,
                "amount": float(loan.amount),
                "loan_id": loan.id,
            })

        # Férias (início em até 7 dias + hoje)
        vacations = Vacation.objects.filter(
            start_date__gte=today,
            start_date__lte=today + timedelta(days=7),
        ).select_related("employee")[:25]
        for v in vacations:
            days = (v.start_date - today).days
            when = "hoje" if days == 0 else f"em {days} dias"
            notifications.append({
                "id": f"vac-{v.id}",
                "type": "vacation",
                "title": f"Férias {when}: {v.employee.name}",
                "date": str(v.start_date),
                "employee_name": v.employee.name,
            })

        notifications.sort(key=lambda x: x["date"])
        unread_types = {"overdue", "collateral_risk"}
        return Response({
            "notifications": notifications,
            "unread_count": len([n for n in notifications if n["type"] in unread_types]),
        })
