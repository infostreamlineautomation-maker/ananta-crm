from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("companies", views.CompanyViewSet, basename="company")
router.register("client-groups", views.ClientGroupViewSet, basename="client-group")
router.register("clients", views.ClientViewSet, basename="client")

urlpatterns = router.urls
