from django.urls import path

from .views import BomReportExportView, ParMetricsView, ReportsListView

urlpatterns = [
    path("", ReportsListView.as_view(), name="reports_list"),
    path("bom-export/", BomReportExportView.as_view(), name="bom_report_export"),
    path("par-metrics/", ParMetricsView.as_view(), name="par_metrics"),
]
