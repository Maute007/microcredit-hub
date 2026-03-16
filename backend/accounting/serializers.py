from decimal import Decimal

from rest_framework import serializers

from validators import MAX_TRANSACTION_AMOUNT

from .models import Tax, Transaction


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
