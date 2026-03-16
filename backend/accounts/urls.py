from django.urls import path

from .auth_views import CookieLogoutView, CookieTokenObtainPairView, CookieTokenRefreshView
from .views import MeView, PermissionListView, SystemSettingsView
from .audit_views import AuditLogView, AuditLogLatestView, AuditLogDetailView

urlpatterns = [
    path("login/", CookieTokenObtainPairView.as_view(), name="auth_login"),
    path("refresh/", CookieTokenRefreshView.as_view(), name="auth_refresh"),
    path("logout/", CookieLogoutView.as_view(), name="auth_logout"),
    path("me/", MeView.as_view(), name="auth_me"),
    path("permissions/", PermissionListView.as_view(), name="permission_list"),
    path("settings/", SystemSettingsView.as_view(), name="system_settings"),
    path("audit/", AuditLogView.as_view(), name="audit_log"),
    path("audit/latest/", AuditLogLatestView.as_view(), name="audit_log_latest"),
    path("audit/detail/", AuditLogDetailView.as_view(), name="audit_log_detail"),
]
