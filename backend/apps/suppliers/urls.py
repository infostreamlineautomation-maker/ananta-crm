from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("suppliers", views.SupplierViewSet, basename="supplier")
router.register("supplier-contacts", views.SupplierContactViewSet, basename="supplier-contact")
router.register("supplier-products", views.SupplierProductViewSet, basename="supplier-product")
router.register("supplier-files", views.SupplierFileViewSet, basename="supplier-file")

urlpatterns = router.urls
