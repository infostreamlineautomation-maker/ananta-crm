from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("countries", views.CountryViewSet, basename="country")
router.register("exchange-rates", views.ExchangeRateViewSet, basename="exchange-rate")
router.register("activity-log", views.ActivityLogViewSet, basename="activity-log")

urlpatterns = router.urls
