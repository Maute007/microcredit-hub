from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Profile, Role, User


@admin.register(Role)
class RoleAdmin(SimpleHistoryAdmin):
    list_display = ("id", "code", "name", "is_system")
    search_fields = ("code", "name")
    list_filter = ("is_system",)
    filter_horizontal = ("permissions",)


@admin.register(User)
class UserAdmin(SimpleHistoryAdmin):
    list_display = ("id", "username", "email", "role", "is_active", "is_staff")
    search_fields = ("username", "email", "first_name", "last_name")
    list_filter = ("is_active", "is_staff", "is_superuser", "role")


@admin.register(Profile)
class ProfileAdmin(SimpleHistoryAdmin):
    list_display = ("id", "user", "phone", "job_title")
    search_fields = ("user__username", "user__email", "phone", "job_title")
