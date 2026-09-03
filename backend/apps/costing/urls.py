from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("costings", views.CostingViewSet, basename="costing")

urlpatterns = router.urls
