from django.contrib import admin

from .models import CalendarEvent


@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    list_display = ["title", "event_type", "event_type_other", "color", "date", "user"]
    list_filter = ["event_type", "date"]
    search_fields = ["title", "client_name"]
