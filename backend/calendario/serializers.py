from decimal import Decimal

from rest_framework import serializers

from validators import MAX_CALENDAR_AMOUNT

from .models import CalendarEvent


class CalendarEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarEvent
        fields = [
            "id",
            "title",
            "event_type",
            "event_type_other",
            "date",
            "description",
            "notify",
            "loan",
            "client_name",
            "amount",
            "color",
        ]
        extra_kwargs = {
            "title": {"max_length": 200},
            "amount": {"min_value": Decimal("0"), "max_value": MAX_CALENDAR_AMOUNT, "allow_null": True},
        }
