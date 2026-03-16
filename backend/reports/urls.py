from django.urls import path

from .views import ReportsListView

urlpatterns = [
    path("", ReportsListView.as_view(), name="reports_list"),
]
