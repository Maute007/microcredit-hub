from decimal import Decimal

from rest_framework import serializers

from validators import MAX_TRANSACTION_AMOUNT

from .models import (
    CompanyFinanceSettings,
    MonthlyFinanceSnapshot,
    MonthlySnapshotActionLog,
    Tax,
    Transaction,
)


class TaxSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tax
        fields = ["id", "name", "code", "rate", "scope", "is_active"]
        extra_kwargs = {"rate": {"min_value": Decimal("0"), "max_value": Decimal("1")}}


class TransactionSerializer(serializers.ModelSerializer):
    responsible_name = serializers.SerializerMethodField()
    tax_name = serializers.CharField(source="tax.name", read_only=True)

    def get_responsible_name(self, obj):
        if obj.responsible:
            return obj.responsible.get_full_name() or obj.responsible.username
        return ""

    class Meta:
        model = Transaction
        fields = [
            "id",
            "type",
            "category",
            "description",
            "amount",
            "tax",
            "tax_name",
            "tax_rate",
            "tax_amount",
            "total_amount",
            "date",
            "responsible",
            "responsible_name",
            "loan",
        ]
        extra_kwargs = {
            "amount": {"min_value": Decimal("0.01"), "max_value": MAX_TRANSACTION_AMOUNT},
        }


class CompanyFinanceSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyFinanceSettings
        fields = ["id", "opening_balance", "updated_at"]
        read_only_fields = ["id", "updated_at"]


class MonthlyFinanceSnapshotSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MonthlyFinanceSnapshot
        fields = [
            "id",
            "month",
            "date_from",
            "date_to",
            "opening_balance",
            "total_entries",
            "total_exits",
            "real_balance",
            "consolidated_balance",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = fields

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return ""


class MonthlySnapshotActionLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = MonthlySnapshotActionLog
        fields = ["id", "snapshot_month", "action", "reason", "user", "user_name", "created_at"]
        read_only_fields = fields

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return ""
