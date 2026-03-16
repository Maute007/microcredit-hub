from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import Collateral, Loan, Payment


@admin.register(Collateral)
class CollateralAdmin(SimpleHistoryAdmin):
    list_display = ("loan", "description", "item_type", "estimated_value", "condition")
    list_filter = ("item_type", "condition")
    search_fields = ("description", "serial_number")


@admin.register(Loan)
class LoanAdmin(SimpleHistoryAdmin):
    list_display = ("client", "amount", "interest_rate", "term", "status", "start_date")
    list_filter = ("status",)
    search_fields = ("client__name",)


@admin.register(Payment)
class PaymentAdmin(SimpleHistoryAdmin):
    list_display = ("loan", "amount", "date", "status", "method", "installment_number")
    list_filter = ("status", "method")
