from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework import routers

from accounts.views import ProfileViewSet, RoleViewSet, UserViewSet
from clients.views import ClientViewSet
from loans.views import LoanCategoryViewSet, LoanViewSet, PaymentViewSet
from hr.views import (
    AttendanceRecordViewSet,
    EmployeeViewSet,
    HRSettingsViewSet,
    PayrollAdjustmentViewSet,
    SalarySlipViewSet,
    VacationViewSet,
)
from accounting.views import TaxViewSet, TransactionViewSet

# DRF router principal
router = routers.DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"profiles", ProfileViewSet, basename="profile")
router.register(r"roles", RoleViewSet, basename="role")
router.register(r"clients", ClientViewSet, basename="client")
router.register(r"loans", LoanViewSet, basename="loan")
router.register(r"loan-categories", LoanCategoryViewSet, basename="loan-category")
router.register(r"payments", PaymentViewSet, basename="payment")
router.register(r"employees", EmployeeViewSet, basename="employee")
router.register(r"vacations", VacationViewSet, basename="vacation")
router.register(r"attendance", AttendanceRecordViewSet, basename="attendance")
router.register(r"salary-slips", SalarySlipViewSet, basename="salary-slip")
router.register(r"hr-settings", HRSettingsViewSet, basename="hr-settings")
router.register(r"payroll-adjustments", PayrollAdjustmentViewSet, basename="payroll-adjustment")
router.register(r"transactions", TransactionViewSet, basename="transaction")
router.register(r"taxes", TaxViewSet, basename="tax")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/", include(router.urls)),
    path("api/auth/", include("accounts.urls")),
    path("api/calendar/", include("calendario.urls")),
    path("api/reports/", include("reports.urls")),
    path("api/dashboard/", include("dashboard.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

