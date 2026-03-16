from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import AttendanceRecord, Employee, SalarySlip, Vacation


@admin.register(Employee)
class EmployeeAdmin(SimpleHistoryAdmin):
    list_display = ("name", "role", "department", "base_salary", "status", "inss_rate", "irps_rate")
    search_fields = ("name", "email")
    list_filter = ("status", "department")


@admin.register(Vacation)
class VacationAdmin(SimpleHistoryAdmin):
    list_display = ("employee", "start_date", "end_date")


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(SimpleHistoryAdmin):
    list_display = ("employee", "date", "check_in", "check_out", "status")


@admin.register(SalarySlip)
class SalarySlipAdmin(SimpleHistoryAdmin):
    list_display = ("employee", "month", "gross_salary", "net_salary")
