from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Transaction


@admin.register(Transaction)
class TransactionAdmin(SimpleHistoryAdmin):
    list_display = ("type", "category", "amount", "date", "responsible")
    list_filter = ("type", "category")
