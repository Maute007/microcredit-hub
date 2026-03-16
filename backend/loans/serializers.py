from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from validators import (
    MAX_COLLATERAL_VALUE,
    MAX_INSTALLMENT_NUMBER,
    MAX_LOAN_AMOUNT,
    MAX_LOAN_TERM_MONTHS,
    MAX_PAYMENT_AMOUNT,
)

from .models import Collateral, Loan, LoanCategory, Payment
from .services import (
    compute_min_payment_for_installment,
    compute_remaining_balance,
    compute_total_due_with_late_interest,
)
from .services import compute_loan_status, update_loan_status


class CollateralSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collateral
        fields = [
            "id",
            "description",
            "item_type",
            "estimated_value",
            "condition",
            "serial_number",
            "notes",
        ]
        extra_kwargs = {
            "estimated_value": {"min_value": Decimal("0"), "max_value": MAX_COLLATERAL_VALUE, "allow_null": True},
        }


class LoanCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanCategory
        fields = [
            "id",
            "name",
            "code",
            "description",
            "min_amount",
            "max_amount",
            "frequency_days",
            "min_term_days",
            "max_term_days",
            "min_installments",
            "max_installments",
            "default_interest_rate",
            "default_term_months",
            "late_interest_rate",
            "max_late_interest_months",
            "collateral_grace_days",
            "require_interest_paid_to_keep_collateral",
            "is_active",
        ]
        extra_kwargs = {
            "min_amount": {"min_value": Decimal("0")},
            "max_amount": {"min_value": Decimal("0"), "allow_null": True},
            "frequency_days": {"min_value": 1, "max_value": 365},
            "min_term_days": {"min_value": 1, "max_value": 3650},
            "max_term_days": {"min_value": 1, "max_value": 3650},
            "min_installments": {"min_value": 1, "max_value": 120},
            "max_installments": {"min_value": 1, "max_value": 120},
            "default_interest_rate": {"min_value": Decimal("0"), "max_value": Decimal("100")},
            "default_term_months": {"min_value": 1, "max_value": 120},
            "late_interest_rate": {"min_value": Decimal("0"), "max_value": Decimal("100")},
            "max_late_interest_months": {"min_value": 0, "max_value": 120},
            "collateral_grace_days": {"min_value": 0, "max_value": 3650},
        }


class LoanSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)
    category_code = serializers.CharField(source="category.code", read_only=True, default=None)
    category_frequency_days = serializers.IntegerField(source="category.frequency_days", read_only=True, default=None)
    category_collateral_grace_days = serializers.IntegerField(source="category.collateral_grace_days", read_only=True, default=None)
    category_require_interest_paid_to_keep_collateral = serializers.BooleanField(
        source="category.require_interest_paid_to_keep_collateral", read_only=True, default=None
    )
    paid_amount = serializers.SerializerMethodField()
    remaining_balance = serializers.SerializerMethodField()
    paid_installments = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    collateral = CollateralSerializer(required=False, allow_null=True)

    class Meta:
        model = Loan
        fields = [
            "id",
            "client",
            "client_name",
             "category",
             "category_name",
             "category_code",
             "category_frequency_days",
             "category_collateral_grace_days",
             "category_require_interest_paid_to_keep_collateral",
            "amount",
            "interest_rate",
            "term",
            "monthly_payment",
            "total_amount",
            "status",
            "start_date",
            "end_date",
            "paid_amount",
            "remaining_balance",
            "paid_installments",
            "collateral",
        ]
        extra_kwargs = {
            "amount": {"min_value": Decimal("0.01"), "max_value": MAX_LOAN_AMOUNT},
            "interest_rate": {"min_value": Decimal("0"), "max_value": Decimal("100")},
            "term": {"min_value": 1, "max_value": MAX_LOAN_TERM_MONTHS},
        }

    def get_paid_amount(self, obj):
        val = getattr(obj, "_paid_amount", None)
        if val is not None:
            return float(val)
        agg = obj.payments.filter(status="pago").aggregate(s=Sum("amount"))
        return float(agg.get("s") or 0)

    def get_remaining_balance(self, obj):
        paid = self.get_paid_amount(obj)
        return round(float(obj.total_amount) - paid, 2)

    def get_paid_installments(self, obj):
        return obj.payments.filter(status="pago").count()

    def get_status(self, obj):
        """Status calculado com base em datas e pagamentos (atrasado quando data passa)."""
        return compute_loan_status(obj)

    def validate_end_date(self, value):
        # Validação principal é feita em validate(), aqui apenas devolvemos o valor
        return value

    def validate(self, data):
        amount = data.get("amount") or (self.instance and self.instance.amount)
        interest_rate = (data.get("interest_rate") is not None and data.get("interest_rate")) or (
            self.instance and self.instance.interest_rate
        ) or Decimal("0")
        term = data.get("term") or (self.instance and self.instance.term)

        # Garantir que end_date é posterior a start_date usando objetos date já convertidos
        start_date = data.get("start_date") or getattr(self.instance, "start_date", None)
        end_date = data.get("end_date") or getattr(self.instance, "end_date", None)
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "Data fim deve ser posterior à data início."})

        if amount and term:
            principal = float(amount) / int(term)
            rate = float(interest_rate) / 100
            interest_per_month = float(amount) * rate / int(term)
            monthly = round(principal + interest_per_month, 2)
            total = round(monthly * int(term), 2)
            data.setdefault("monthly_payment", Decimal(str(monthly)))
            data.setdefault("total_amount", Decimal(str(total)))
        return data

    def create(self, validated_data):
        collateral_data = validated_data.pop("collateral", None)
        loan = super().create(validated_data)
        if collateral_data and collateral_data.get("description"):
            Collateral.objects.create(loan=loan, **collateral_data)
        update_loan_status(loan)  # Status inicial (pendente/ativo conforme data)
        return loan

    def update(self, instance, validated_data):
        _sentinel = object()
        collateral_data = validated_data.pop("collateral", _sentinel)
        loan = super().update(instance, validated_data)
        if collateral_data is not _sentinel:
            if collateral_data and collateral_data.get("description"):
                Collateral.objects.update_or_create(loan=loan, defaults=collateral_data)
            elif getattr(loan, "collateral", None):
                loan.collateral.delete()
        return loan


class PaymentSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="loan.client.name", read_only=True)
    loan_id = serializers.IntegerField(source="loan.id", read_only=True)
    loan_client_name = serializers.CharField(source="loan.client.name", read_only=True)
    loan_total_amount = serializers.SerializerMethodField()
    loan_remaining_balance = serializers.SerializerMethodField()
    loan_paid_installments = serializers.SerializerMethodField()
    loan_term = serializers.IntegerField(source="loan.term", read_only=True)
    loan_monthly_payment = serializers.DecimalField(
        source="loan.monthly_payment", max_digits=14, decimal_places=2, read_only=True
    )

    def get_loan_total_amount(self, obj):
        return float(obj.loan.total_amount or 0)

    def get_loan_remaining_balance(self, obj):
        paid = obj.loan.payments.filter(status="pago").aggregate(s=Sum("amount"))["s"] or Decimal("0")
        return round(float(obj.loan.total_amount or 0) - float(paid), 2)

    def get_loan_paid_installments(self, obj):
        return obj.loan.payments.filter(status="pago").count()

    def validate(self, data):
        amount = data.get("amount")
        loan = data.get("loan") or (self.instance and self.instance.loan)
        installment_number = data.get("installment_number")
        if installment_number is None and self.instance:
            installment_number = self.instance.installment_number

        if loan:
            term = loan.term
            if installment_number is not None and (installment_number < 1 or installment_number > term):
                raise serializers.ValidationError(
                    {"installment_number": f"A prestação deve ser entre 1 e {term}."}
                )

            if amount is not None and amount > 0 and installment_number is not None:
                from datetime import date
                exclude_id = self.instance.id if (self.instance and self.instance.status == "pago") else None
                min_payment = compute_min_payment_for_installment(
                    loan, installment_number, exclude_payment_id=exclude_id
                )
                if amount < min_payment:
                    raise serializers.ValidationError(
                        {"amount": f"O valor mínimo para esta parcela é {min_payment} MT."}
                    )
                remaining = compute_remaining_balance(loan, exclude_payment_id=exclude_id)
                max_allowed = remaining
                if loan.end_date < date.today():
                    max_allowed = compute_total_due_with_late_interest(
                        loan, exclude_payment_id=exclude_id
                    )
                if amount > max_allowed:
                    raise serializers.ValidationError(
                        {
                            "amount": f"O valor não pode exceder {max_allowed} MT (saldo + juros de mora)."
                        }
                    )
        return data

    class Meta:
        model = Payment
        fields = [
            "id",
            "loan",
            "loan_id",
            "client_name",
            "loan_client_name",
            "loan_total_amount",
            "loan_remaining_balance",
            "loan_paid_installments",
            "loan_term",
            "loan_monthly_payment",
            "amount",
            "date",
            "status",
            "method",
            "method_other",
            "installment_number",
            "receipt",
            "receipt_file",
        ]
        extra_kwargs = {
            "amount": {"min_value": Decimal("0.01"), "max_value": MAX_PAYMENT_AMOUNT},
            "installment_number": {"min_value": 1, "max_value": MAX_INSTALLMENT_NUMBER},
        }
