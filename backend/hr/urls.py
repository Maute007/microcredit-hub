from django.urls import include, path
from rest_framework import routers

from .views import (
    AttendanceRecordViewSet,
    EmployeeViewSet,
  HRSettingsViewSet,
  PayrollAdjustmentViewSet,
    SalarySlipViewSet,
    VacationViewSet,
)

router = routers.SimpleRouter()
router.register(r"employees", EmployeeViewSet, basename="employee")
router.register(r"vacations", VacationViewSet, basename="vacation")
router.register(r"attendance", AttendanceRecordViewSet, basename="attendance")
router.register(r"salary-slips", SalarySlipViewSet, basename="salary-slip")
router.register(r"hr-settings", HRSettingsViewSet, basename="hr-settings")
router.register(r"payroll-adjustments", PayrollAdjustmentViewSet, basename="payroll-adjustment")

urlpatterns = [
    path("", include(router.urls)),
]
