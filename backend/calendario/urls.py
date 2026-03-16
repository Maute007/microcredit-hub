from django.urls import path

from .views import (
    CalendarEventDetailView,
    CalendarEventViewSet,
    CalendarEventsView,
    NotificationsView,
)

urlpatterns = [
    path("events/", CalendarEventsView.as_view(), name="calendar_events"),
    path("custom/", CalendarEventViewSet.as_view(), name="calendar_custom"),
    path("custom/<int:pk>/", CalendarEventDetailView.as_view(), name="calendar_custom_detail"),
    path("notifications/", NotificationsView.as_view(), name="calendar_notifications"),
]
