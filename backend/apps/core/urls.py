from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("countries", views.CountryViewSet, basename="country")
router.register("exchange-rates", views.ExchangeRateViewSet, basename="exchange-rate")
router.register("activity-log", views.ActivityLogViewSet, basename="activity-log")
router.register("custom-fields", views.CustomFieldDefinitionViewSet, basename="custom-field")

urlpatterns = [
    path("quick-search/", views.QuickSearchView.as_view(), name="quick-search"),
] + router.urls

