from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination

from validators import MAX_PAGE_SIZE
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from accounts.permissions import RoleAwareDjangoModelPermissions, user_has_permission

from .models import AttendanceRecord, Employee, HRSettings, PayrollAdjustment, SalarySlip, Vacation
from .serializers import (
    AttendanceRecordSerializer,
    EmployeeSerializer,
    HRSettingsSerializer,
    PayrollAdjustmentSerializer,
    SalarySlipSerializer,
    VacationSerializer,
)
from .services import simulate_salary_from_employee, simulate_salary_slip


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = MAX_PAGE_SIZE


class EmployeeViewSet(ModelViewSet):
    serializer_class = EmployeeSerializer
    permission_classes = [RoleAwareDjangoModelPermissions]
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = Employee.objects.all()
        status_filter = self.request.query_params.get("status")
        department = self.request.query_params.get("department", "").strip()
        search = self.request.query_params.get("search", "").strip()
        ordering = self.request.query_params.get("ordering", "name")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if department:
            qs = qs.filter(department__icontains=department)
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(email__icontains=search)
                | Q(role__icontains=search)
            )
        if ordering.lstrip("-") in ("id", "name", "role", "department", "hire_date", "status"):
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by("name")
        return qs


class VacationViewSet(ModelViewSet):
    serializer_class = VacationSerializer
    permission_classes = [RoleAwareDjangoModelPermissions]
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = Vacation.objects.select_related("employee").order_by("-start_date")
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        return qs


class AttendanceRecordViewSet(ModelViewSet):
    serializer_class = AttendanceRecordSerializer
    permission_classes = [RoleAwareDjangoModelPermissions]
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = AttendanceRecord.objects.select_related("employee").order_by("-date")
        employee_id = self.request.query_params.get("employee")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        status_filter = self.request.query_params.get("status")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def list(self, request, *args, **kwargs):
        """
        Ao listar presenças num intervalo passado, auto-cria registos ausentes
        para dias úteis em falta (se configurado).
        """
        settings = HRSettings.get_solo()
        if settings.auto_fill_attendance:
            from datetime import date as dt_date, timedelta

            date_from = request.query_params.get("date_from")
            date_to = request.query_params.get("date_to")
            employee_id = request.query_params.get("employee")
            try:
                df = dt_date.fromisoformat(date_from) if date_from else None
                dt = dt_date.fromisoformat(date_to) if date_to else None
            except ValueError:
                df, dt = None, None

            if df and dt:
                today = dt_date.today()
                # só preenche até hoje
                end = min(dt, today)
                start = min(df, end)
                weekend_days = set(settings.weekend_days or [5, 6])

                employees_qs = Employee.objects.filter(status="ativo")
                if employee_id:
                    employees_qs = employees_qs.filter(pk=employee_id)

                # Pré-carregar férias no intervalo
                vacs = Vacation.objects.filter(
                    employee__in=employees_qs,
                    start_date__lte=end,
                    end_date__gte=start,
                )

                def is_weekend(d):
                    # python: Monday=0 ... Sunday=6
                    return d.weekday() in weekend_days

                d = start
                while d <= end:
                    if not is_weekend(d):
                        for emp in employees_qs:
                            if emp.hire_date and d < emp.hire_date:
                                continue
                            # Se já existe, não mexe
                            if AttendanceRecord.objects.filter(employee=emp, date=d).exists():
                                continue
                            # Se estiver de férias, cria como ferias
                            on_vac = vacs.filter(employee=emp, start_date__lte=d, end_date__gte=d).exists()
                            AttendanceRecord.objects.create(
                                employee=emp,
                                date=d,
                                status="ferias" if on_vac else "ausente",
                                hours_worked=0,
                            )
                    d += timedelta(days=1)

        return super().list(request, *args, **kwargs)


class HRSettingsViewSet(ModelViewSet):
    serializer_class = HRSettingsSerializer
    permission_classes = [RoleAwareDjangoModelPermissions]
    pagination_class = None

    def get_permissions(self):
        # O frontend salva definições por POST em /hr-settings/ (singleton).
        # Tratar esse POST como "alteração" para não exigir add_hrsettings.
        if self.request.method == "POST":
            class _CanChangeHRSettings(permissions.BasePermission):
                def has_permission(self, request, view):
                    return user_has_permission(request.user, "hr.change_hrsettings")

            return [_CanChangeHRSettings()]
        return [RoleAwareDjangoModelPermissions()]

    def get_queryset(self):
        return HRSettings.objects.all()

    def list(self, request, *args, **kwargs):
        obj = HRSettings.get_solo()
        return Response(self.serializer_class(obj).data)

    def create(self, request, *args, **kwargs):
        obj = HRSettings.get_solo()
        serializer = self.serializer_class(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        obj = HRSettings.get_solo()
        serializer = self.serializer_class(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)


class SalarySlipViewSet(ModelViewSet):
    serializer_class = SalarySlipSerializer
    permission_classes = [RoleAwareDjangoModelPermissions]
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = SalarySlip.objects.select_related("employee").order_by("-month")
        employee_id = self.request.query_params.get("employee")
        month = self.request.query_params.get("month")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        if month:
            qs = qs.filter(month=month)
        return qs

    @action(detail=False, methods=["post"], url_path="simulate")
    def simulate(self, request):
        """
        Simula recibo de vencimento sem gravar.
        Body: {"employee": <id>, "month": "YYYY-MM", "overtime": 0, "bonus": 0}
        """
        employee_id = request.data.get("employee")
        month = request.data.get("month", "")
        overtime = request.data.get("overtime")
        bonus = request.data.get("bonus")
        if not employee_id:
            return Response(
                {"detail": "employee é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            employee = Employee.objects.get(pk=employee_id)
        except Employee.DoesNotExist:
            return Response(
                {"detail": "Colaborador não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if len(month) != 7 or month[4] != "-":
            return Response(
                {"detail": "month deve ter formato YYYY-MM."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from decimal import Decimal
        overtime = Decimal(str(overtime)) if overtime is not None else None
        bonus = Decimal(str(bonus)) if bonus is not None else None
        data = simulate_salary_from_employee(employee, month, overtime, bonus)
        return Response(data)

    @action(detail=False, methods=["post"], url_path="simulate-bulk")
    def simulate_bulk(self, request):
        """
        Simula folha salarial de todos os ativos para um mês.
        Body: {"month": "YYYY-MM"}
        """
        month = request.data.get("month", "")
        if len(month) != 7 or month[4] != "-":
            return Response(
                {"detail": "month deve ter formato YYYY-MM."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            y, m = int(month[:4]), int(month[5:7])
        except ValueError:
            return Response(
                {"detail": "month deve ter formato YYYY-MM."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from datetime import date
        import calendar as cal_module
        start = date(y, m, 1)
        end = date(y, m, cal_module.monthrange(y, m)[1])
        employees = Employee.objects.filter(status="ativo")
        attendance_qs = AttendanceRecord.objects.filter(date__gte=start, date__lte=end)
        adjs = PayrollAdjustment.objects.filter(month=month, employee__in=employees)
        from collections import defaultdict

        adj_by_emp = defaultdict(lambda: {"overtime": 0, "bonus": 0, "manual": 0})
        for a in adjs:
            bucket = adj_by_emp[a.employee_id]
            bucket["overtime"] += float(a.overtime or 0)
            bucket["bonus"] += float(a.bonus or 0)
            bucket["manual"] += float(a.other_deductions_manual or 0)
        slips = []
        total_gross = 0
        total_net = 0
        for emp in employees:
            emp_records = attendance_qs.filter(employee_id=emp.id)
            absent = emp_records.filter(status="ausente").count()
            late = emp_records.filter(status="atrasado").count()
            adj = adj_by_emp.get(emp.id)
            overtime = adj["overtime"] if adj else None
            bonus = adj["bonus"] if adj else None
            manual_ded = adj["manual"] if adj else 0
            data = simulate_salary_from_employee(
                emp,
                month,
                overtime=overtime,
                bonus=bonus,
                attendance_counts={"absent": absent, "late": late},
            )
            # Acrescentar descontos manuais ao campo other_deductions / totals
            if manual_ded:
                data["other_deductions"] = round(float(data.get("other_deductions", 0)) + float(manual_ded), 2)
                data["total_deductions"] = round(float(data.get("total_deductions", 0)) + float(manual_ded), 2)
                data["net_salary"] = round(float(data.get("net_salary", 0)) - float(manual_ded), 2)
            data["adjustments"] = {
                "overtime": float(adj["overtime"]) if adj else 0,
                "bonus": float(adj["bonus"]) if adj else 0,
                "other_deductions_manual": float(adj["manual"]) if adj else 0,
            }
            slips.append(data)
            total_gross += data["gross_salary"]
            total_net += data["net_salary"]
        return Response(
            {
                "month": month,
                "slips": slips,
                "summary": {
                    "total_employees": len(slips),
                    "total_gross_salary": round(total_gross, 2),
                    "total_net_salary": round(total_net, 2),
                    "total_deductions": round(total_gross - total_net, 2),
                },
            }
        )


class PayrollAdjustmentViewSet(ModelViewSet):
    serializer_class = PayrollAdjustmentSerializer
    permission_classes = [RoleAwareDjangoModelPermissions]
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = PayrollAdjustment.objects.select_related("employee").order_by("-month", "employee__name")
        month = self.request.query_params.get("month")
        employee_id = self.request.query_params.get("employee")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        has_bonus = self.request.query_params.get("has_bonus")
        has_overtime = self.request.query_params.get("has_overtime")
        if month:
            qs = qs.filter(month=month)
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        if has_bonus in ("1", "true", "True"):
            qs = qs.filter(bonus__gt=0)
        if has_overtime in ("1", "true", "True"):
            qs = qs.filter(overtime__gt=0)
        return qs

    def create(self, request, *args, **kwargs):
        """
        Upsert por (employee, month, date): se existir, actualiza; senão cria.
        """
        employee_id = request.data.get("employee")
        month = request.data.get("month")
        date_val = request.data.get("date")
        if not employee_id or not month:
            return Response({"detail": "employee e month são obrigatórios."}, status=status.HTTP_400_BAD_REQUEST)
        if not date_val:
            # permitimos vazio, criando sempre um novo registo
            serializer = self.serializer_class(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        try:
            obj = PayrollAdjustment.objects.get(employee_id=employee_id, month=month, date=date_val)
            serializer = self.serializer_class(obj, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        except PayrollAdjustment.DoesNotExist:
            serializer = self.serializer_class(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        """Listar histórico (django-simple-history) do lançamento."""
        obj = self.get_object()
        records = []
        for h in obj.history.all()[:50]:
            records.append({
                "history_id": h.history_id,
                "history_date": h.history_date.isoformat() if h.history_date else None,
                "history_type": h.history_type,
                "history_type_label": {"+": "Criado", "~": "Alterado", "-": "Eliminado"}.get(h.history_type, h.history_type),
                "history_change_reason": h.history_change_reason or "",
                "history_user": h.history_user.get_full_name() or h.history_user.username if h.history_user else None,
                "history_user_username": h.history_user.username if h.history_user else None,
                "overtime": float(h.overtime or 0),
                "bonus": float(h.bonus or 0),
                "other_deductions_manual": float(h.other_deductions_manual or 0),
                "notes": h.notes or "",
                "date": str(h.date) if h.date else None,
            })
        return Response(records)
