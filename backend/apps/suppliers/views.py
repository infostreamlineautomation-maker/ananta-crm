from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.core.filters import DynamicQueryFilterBackend
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
    filter_backends = [DjangoFilterBackend, SearchFilter, DynamicQueryFilterBackend]
    search_fields = ["supplier_name", "company_name", "contact", "email", "source", "product_details", "address", "remark"]


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
            details=f"Uploaded {instance.file_type}: {instance.file.name}",
        )

    @action(detail=False, methods=["POST"], parser_classes=[MultiPartParser, FormParser])
    def bulk_upload(self, request):
        supplier_id = request.data.get("supplier")
        file_type = request.data.get("file_type", "quotation")
        if not supplier_id:
            return Response({"error": "supplier id is required"}, status=400)

        supplier = get_object_or_404(Supplier, id=supplier_id, organization=request.organization)
        files = request.FILES.getlist("files") or request.FILES.getlist("file")
        if not files:
            return Response({"error": "No files uploaded"}, status=400)

        created = []
        for f in files:
            instance = SupplierFile.objects.create(
                supplier=supplier,
                file_type=file_type,
                file=f,
                file_size=f.size,
                mime_type=getattr(f, "content_type", "") or "",
                uploaded_by=request.user,
            )
            ActivityLog.objects.create(
                user=request.user,
                module=SUPPLIERS,
                object_id=supplier.id,
                action="file_upload",
                details=f"Uploaded {file_type}: {instance.file.name}",
            )
            created.append(instance)

        serializer = self.get_serializer(created, many=True)
        return Response(serializer.data, status=201)

