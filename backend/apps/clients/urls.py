from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("companies", views.CompanyViewSet, basename="company")
router.register("clients", views.ClientViewSet, basename="client")

urlpatterns = router.urls
