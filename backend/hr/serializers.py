from decimal import Decimal

from rest_framework import serializers

from validators import MAX_SALARY

from .models import AttendanceRecord, Employee, HRSettings, PayrollAdjustment, SalarySlip, Vacation


class EmployeeSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "name",
            "role",
            "department",
            "base_salary",
            "phone",
            "email",
            "status",
            "hire_date",
            "color",
            "user_id",
            "user_username",
            "inss_rate",
            "irps_rate",
            "other_deductions_rate",
            "overtime_rate_default",
            "penalty_absent_rate",
            "penalty_late_rate",
        ]
        extra_kwargs = {
            "name": {"min_length": 2, "max_length": 200},
            "role": {"max_length": 100},
            "department": {"max_length": 100},
            "base_salary": {"min_value": Decimal("0"), "max_value": MAX_SALARY},
            "inss_rate": {"min_value": Decimal("0"), "max_value": Decimal("1")},
            "irps_rate": {"min_value": Decimal("0"), "max_value": Decimal("1")},
            "other_deductions_rate": {"min_value": Decimal("0"), "max_value": Decimal("1")},
            "overtime_rate_default": {"min_value": Decimal("0"), "max_value": Decimal("1")},
            "penalty_absent_rate": {"min_value": Decimal("0"), "max_value": Decimal("1")},
            "penalty_late_rate": {"min_value": Decimal("0"), "max_value": Decimal("1")},
        }

    def validate_name(self, value):
        if not (value or "").strip():
            raise serializers.ValidationError("Nome é obrigatório.")
        return value.strip()


class VacationSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.name", read_only=True)

    class Meta:
        model = Vacation
        fields = ["id", "employee", "employee_name", "start_date", "end_date", "color"]

    def validate_end_date(self, value):
        start = self.initial_data.get("start_date") or (
            self.instance and self.instance.start_date
        )
        if start and value and value < start:
            raise serializers.ValidationError("Data fim deve ser posterior à data início.")
        return value


class AttendanceRecordSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.name", read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = [
            "id",
            "employee",
            "employee_name",
            "date",
            "check_in",
            "check_out",
            "status",
            "hours_worked",
        ]
        extra_kwargs = {"hours_worked": {"min_value": Decimal("0"), "max_value": Decimal("24")}}

    def validate(self, data):
        employee = data.get("employee")
        date_val = data.get("date")
        if employee and date_val and not self.instance:
            if AttendanceRecord.objects.filter(employee=employee, date=date_val).exists():
                raise serializers.ValidationError(
                    {"date": "Já existe registo de ponto para este colaborador nesta data."}
                )
        # Calcular horas automaticamente quando houver entrada/saída
        check_in = data.get("check_in")
        check_out = data.get("check_out")
        status = data.get("status") or (self.instance and self.instance.status)
        if status in ("ausente", "ferias"):
            data["hours_worked"] = Decimal("0")
            return data
        if check_in and check_out:
            from datetime import datetime, date as dt_date
            start = datetime.combine(dt_date.today(), check_in)
            end = datetime.combine(dt_date.today(), check_out)
            if end < start:
                raise serializers.ValidationError({"check_out": "Saída deve ser posterior à entrada."})
            hours = Decimal(str((end - start).total_seconds() / 3600)).quantize(Decimal("0.01"))
            data["hours_worked"] = max(Decimal("0"), min(Decimal("24"), hours))
        elif check_in or check_out:
            # meio registo: manter hours_worked = 0 para evitar números errados
            data["hours_worked"] = Decimal("0")
        return data


class SalarySlipSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.name", read_only=True)
    role = serializers.CharField(source="employee.role", read_only=True)

    class Meta:
        model = SalarySlip
        fields = [
            "id",
            "employee",
            "employee_name",
            "role",
            "month",
            "base_salary",
            "overtime",
            "bonus",
            "gross_salary",
            "inss",
            "irps",
            "other_deductions",
            "total_deductions",
            "net_salary",
        ]
        extra_kwargs = {"month": {}}

    def validate_month(self, value):
        if value and len(value) == 7 and value[4] == "-":
            try:
                y, m = int(value[:4]), int(value[5:7])
                if 1 <= m <= 12 and 2000 <= y <= 2100:
                    return value
            except ValueError:
                pass
        raise serializers.ValidationError("Formato inválido. Use YYYY-MM.")


class PayrollAdjustmentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.name", read_only=True)

    class Meta:
        model = PayrollAdjustment
        fields = [
            "id",
            "employee",
            "employee_name",
            "month",
            "date",
            "overtime",
            "bonus",
            "other_deductions_manual",
            "notes",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "overtime": {"min_value": Decimal("-999999"), "max_value": MAX_SALARY},
            "bonus": {"min_value": Decimal("0"), "max_value": MAX_SALARY},
            "other_deductions_manual": {"min_value": Decimal("0"), "max_value": MAX_SALARY},
            "notes": {"max_length": 500},
        }

    def validate_month(self, value):
        if value and len(value) == 7 and value[4] == "-":
            try:
                y, m = int(value[:4]), int(value[5:7])
                if 1 <= m <= 12 and 2000 <= y <= 2100:
                    return value
            except ValueError:
                pass
        raise serializers.ValidationError("Formato inválido. Use YYYY-MM.")


class HRSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = HRSettings
        fields = [
            "id",
            "weekend_days",
            "workday_start",
            "workday_end",
            "weekend_start",
            "weekend_end",
            "auto_fill_attendance",
            "late_grace_minutes",
            "good_hours_ratio",
            "ok_hours_ratio",
            "auto_detect_late",
        ]

    def validate_weekend_days(self, value):
        if value is None:
            return [5, 6]
        if not isinstance(value, list):
            raise serializers.ValidationError("weekend_days deve ser uma lista.")
        cleaned = []
        for v in value:
            try:
                n = int(v)
            except (TypeError, ValueError):
                raise serializers.ValidationError("weekend_days deve conter inteiros 0..6.")
            if n < 0 or n > 6:
                raise serializers.ValidationError("weekend_days deve conter valores entre 0 e 6.")
            cleaned.append(n)
        return sorted(list(set(cleaned)))

    def validate_late_grace_minutes(self, value):
        if value is None:
            return 10
        if value < 0 or value > 240:
            raise serializers.ValidationError("Use um valor entre 0 e 240.")
        return value

    def validate_good_hours_ratio(self, value):
        if value is None:
            return 0.90
        if value < 0 or value > 1:
            raise serializers.ValidationError("Use um ratio entre 0 e 1.")
        return value

    def validate_ok_hours_ratio(self, value):
        if value is None:
            return 0.75
        if value < 0 or value > 1:
            raise serializers.ValidationError("Use um ratio entre 0 e 1.")
        return value
