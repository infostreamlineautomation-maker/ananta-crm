from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("orders", views.OrderViewSet, basename="order")
router.register("order-images", views.OrderImageViewSet, basename="order-image")

urlpatterns = router.urls
