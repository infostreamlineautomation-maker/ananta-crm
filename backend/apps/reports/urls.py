from django.urls import path

from . import views

urlpatterns = [
    path("reports/summary/", views.summary, name="report-summary"),
    path("reports/analytics/", views.analytics, name="report-analytics"),
    path("reports/export/", views.export_csv, name="report-export-csv"),
    path("reports/sales-by-product/", views.sales_by_product, name="report-sales-by-product"),
    path("reports/top-clients/", views.top_clients, name="report-top-clients"),
]
