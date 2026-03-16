from rest_framework import serializers

from validators import MAX_DESCRIPTION_LENGTH

from .models import Client


class ClientSerializer(serializers.ModelSerializer):
    total_loans = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            "id",
            "name",
            "email",
            "phone",
            "document",
            "address",
            "city",
            "occupation",
            "status",
            "created_at",
            "total_loans",
        ]
        read_only_fields = ["id", "created_at"]
        extra_kwargs = {
            "name": {"min_length": 2, "max_length": 200},
            "document": {"max_length": 50, "required": False, "allow_blank": True},
            "email": {"max_length": 254, "required": False, "allow_blank": True},
            "phone": {"max_length": 30, "required": False, "allow_blank": True},
            "address": {"max_length": MAX_DESCRIPTION_LENGTH, "required": False, "allow_blank": True},
            "city": {"max_length": 100, "required": False, "allow_blank": True},
            "occupation": {"max_length": 100, "required": False, "allow_blank": True},
        }

    def get_total_loans(self, obj):
        return getattr(obj, "_total_loans", obj.loans.count())

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Nome é obrigatório.")
        return value.strip()

    def validate_document(self, value):
        value = (value or "").strip()
        if not value:
            return value
        qs = Client.objects.filter(document__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Documento já existe.")
        return value

    def validate_email(self, value):
        value = (value or "").strip()
        if not value:
            return value
        qs = Client.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("E-mail já existe.")
        return value
