from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Client


@admin.register(Client)
class ClientAdmin(SimpleHistoryAdmin):
    list_display = ("name", "document", "phone", "city", "status")
    search_fields = ("name", "email", "document", "phone")
    list_filter = ("status", "city")
