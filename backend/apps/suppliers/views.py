from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter
from rest_framework.parsers import FormParser, MultiPartParser

from apps.core.models import ActivityLog
from apps.core.modules import SUPPLIERS
from apps.core.viewsets import ModuleViewSet, SoftDeleteModuleViewSet

from .models import Supplier, SupplierContact, SupplierFile, SupplierProduct
from .serializers import (
    SupplierContactSerializer,
    SupplierFileSerializer,
    SupplierProductSerializer,
    SupplierSerializer,
)


class SupplierViewSet(SoftDeleteModuleViewSet):
    # create/update/delete activity logging is handled by the base
    # SoftDeleteModuleViewSet/ModuleViewSet now (see apps.core.viewsets) —
    # this was the one-off version that pattern was generalized from.
    queryset = Supplier.objects.prefetch_related("contacts", "supplier_products__product", "files").all()
    serializer_class = SupplierSerializer
    module_name = SUPPLIERS
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ["supplier_name", "contact", "email", "source"]


class SupplierContactViewSet(ModuleViewSet):
    queryset = SupplierContact.objects.all()
    serializer_class = SupplierContactSerializer
    module_name = SUPPLIERS
    filterset_fields = ["supplier"]
    filter_backends = [DjangoFilterBackend]

    # This table's own pk isn't meaningful on a Supplier's Activity Log tab —
    # log against the parent supplier's id instead (see ModuleViewSet._log_object_id).
    def _log_object_id(self, instance):
        return instance.supplier_id

    def _log_details(self, instance):
        return instance.contact_name


class SupplierProductViewSet(ModuleViewSet):
    queryset = SupplierProduct.objects.select_related("product").all()
    serializer_class = SupplierProductSerializer
    module_name = SUPPLIERS
    filterset_fields = ["supplier"]
    filter_backends = [DjangoFilterBackend]

    def _log_object_id(self, instance):
        return instance.supplier_id

    def _log_details(self, instance):
        return instance.product.product_name


class SupplierFileViewSet(ModuleViewSet):
    queryset = SupplierFile.objects.all()
    serializer_class = SupplierFileSerializer
    module_name = SUPPLIERS
    filterset_fields = ["supplier", "file_type"]
    filter_backends = [DjangoFilterBackend]
    parser_classes = [MultiPartParser, FormParser]

    def perform_create(self, serializer):
        f = serializer.validated_data["file"]
        instance = serializer.save(
            uploaded_by=self.request.user, file_size=f.size, mime_type=getattr(f, "content_type", "") or ""
        )
        ActivityLog.objects.create(
            user=self.request.user,
            module=SUPPLIERS,
            object_id=instance.supplier_id,
            action="file_upload",
            details=instance.file.name,
        )
