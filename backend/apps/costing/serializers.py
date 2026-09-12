import base64
import mimetypes
import uuid
from django.core.files.base import ContentFile
from rest_framework import serializers

from apps.catalog.models import Product
from apps.clients.models import Client
from apps.core.serializers import SameOrganizationFieldsMixin
from apps.suppliers.models import Supplier

from .models import Costing, CostingFile, CostingItem


MIME_TO_EXT = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/msword": ".doc",
    "application/pdf": ".pdf",
    "text/csv": ".csv",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/gif": ".gif",
}


class Base64OrURLFileField(serializers.FileField):
    def to_internal_value(self, data):
        if not data:
            return None
        if isinstance(data, str):
            if data.startswith("data:"):
                try:
                    format_prefix, filestr = data.split(";base64,")
                    mime = format_prefix.replace("data:", "").split(";")[0].strip().lower()
                    ext = MIME_TO_EXT.get(mime) or mimetypes.guess_extension(mime) or ".bin"
                    if ext == ".jpe":
                        ext = ".jpg"
                    file_name = f"{uuid.uuid4().hex}{ext}"
                    return ContentFile(base64.b64decode(filestr), name=file_name)
                except Exception:
                    raise serializers.ValidationError("Invalid base64 file data.")
            elif data.startswith("http://") or data.startswith("https://") or data.startswith("/media/") or data.startswith("media/"):
                return "__KEEP_EXISTING__"
        return super().to_internal_value(data)


class CostingFileSerializer(serializers.ModelSerializer):
    file = Base64OrURLFileField(required=False, allow_null=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = CostingFile
        fields = ["id", "file", "file_name", "file_size", "uploaded_at", "file_url"]
        read_only_fields = ["uploaded_at", "file_url"]

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None


class CostingItemSerializer(serializers.ModelSerializer):
    profit = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = CostingItem
        fields = ["id", "supplier_rate", "quantity", "client_rate", "profit", "extra_data"]


class CostingSerializer(SameOrganizationFieldsMixin, serializers.ModelSerializer):
    """Ports the legacy "fast-track" UX (pick an existing supplier/product/
    client, or type a new name and it gets created) but resolves to a real FK
    before saving, instead of the legacy app's free-text columns matched by
    name after the fact. Send either `supplier` (an id) or `supplier_name` (a
    string — used to find-or-create), and likewise for product/client.

    same_organization_fields covers the case where an id *is* sent directly;
    when a *_name is sent instead, _resolve()'s own org-scoped get_or_create
    is what keeps that path safe."""

    same_organization_fields = ["supplier", "product", "client", "project"]

    items = CostingItemSerializer(many=True)
    files = CostingFileSerializer(many=True, required=False)
    supplier_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    product_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    client_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    supplier_display = serializers.CharField(source="supplier.supplier_name", read_only=True)
    product_display = serializers.CharField(source="product.product_name", read_only=True)
    client_display = serializers.CharField(source="client.client_name", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)

    file = Base64OrURLFileField(required=False, allow_null=True)
    file_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    supplier_cost = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    client_revenue = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    profit = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    profit_percent = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)

    class Meta:
        model = Costing
        fields = [
            "id", "costing_date", "project", "project_name",
            "supplier", "supplier_name", "supplier_display",
            "product", "product_name", "product_display",
            "client", "client_name", "client_display",
            "file", "file_name", "files",
            "description", "columns_config", "items", "supplier_cost", "client_revenue", "profit", "profit_percent",
            "is_deleted", "created_by", "created_at", "updated_at",
        ]
        extra_kwargs = {"supplier": {"required": False}, "product": {"required": False}, "client": {"required": False}}
        read_only_fields = ["is_deleted", "created_by", "created_at", "updated_at"]

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("A costing sheet needs at least one line item.")
        return value

    def _resolve(self, validated_data, organization):
        supplier = validated_data.pop("supplier", None)
        supplier_name = validated_data.pop("supplier_name", "").strip()
        if not supplier and supplier_name:
            supplier, _ = Supplier.objects.get_or_create(
                organization=organization, supplier_name__iexact=supplier_name, defaults={"supplier_name": supplier_name, "organization": organization}
            )
        validated_data["supplier"] = supplier

        product = validated_data.pop("product", None)
        product_name = validated_data.pop("product_name", "").strip()
        if not product and product_name:
            product, _ = Product.objects.get_or_create(
                organization=organization, product_name__iexact=product_name, defaults={"product_name": product_name, "organization": organization}
            )
        validated_data["product"] = product

        client = validated_data.pop("client", None)
        client_name = validated_data.pop("client_name", "").strip()
        if not client and client_name:
            client, _ = Client.objects.get_or_create(
                organization=organization, client_name__iexact=client_name, defaults={"client_name": client_name, "organization": organization}
            )
        validated_data["client"] = client

        if not (validated_data["supplier"] and validated_data["product"] and validated_data["client"]):
            raise serializers.ValidationError("Supplier, product, and client are all required (pick one or type a new name).")
        return validated_data

    def _handle_files(self, costing, files_data, raw_files_list=None):
        if files_data is None:
            return
        kept_file_ids = set()
        raw_list = raw_files_list if isinstance(raw_files_list, list) else []
        for idx, f_data in enumerate(files_data):
            raw_item = raw_list[idx] if idx < len(raw_list) and isinstance(raw_list[idx], dict) else {}
            file_id = f_data.get("id") or raw_item.get("id")
            file_content = f_data.get("file")
            file_name = f_data.get("file_name", "") or raw_item.get("file_name", "")
            file_size = f_data.get("file_size") or raw_item.get("file_size")

            if file_id and CostingFile.objects.filter(costing=costing, id=file_id).exists():
                cf = CostingFile.objects.get(costing=costing, id=file_id)
                if file_content and file_content != "__KEEP_EXISTING__":
                    cf.file = file_content
                if file_name:
                    cf.file_name = file_name
                if file_size is not None:
                    cf.file_size = file_size
                cf.save()
                kept_file_ids.add(cf.id)
            elif file_content and file_content != "__KEEP_EXISTING__":
                cf = CostingFile.objects.create(
                    costing=costing,
                    file=file_content,
                    file_name=file_name,
                    file_size=file_size,
                )
                kept_file_ids.add(cf.id)

        # Delete any files that were removed
        costing.files.exclude(id__in=kept_file_ids).delete()

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        files_data = validated_data.pop("files", None)
        raw_files = self.initial_data.get("files", [])
        organization = validated_data["organization"]
        if validated_data.get("file") == "__KEEP_EXISTING__":
            validated_data["file"] = None
        validated_data = self._resolve(validated_data, organization)
        costing = Costing.objects.create(**validated_data)
        for item_data in items_data:
            CostingItem.objects.create(costing=costing, **item_data)
        if files_data is not None:
            self._handle_files(costing, files_data, raw_files)
        return costing

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        files_data = validated_data.pop("files", None)
        raw_files = self.initial_data.get("files", [])
        if validated_data.get("file") == "__KEEP_EXISTING__":
            validated_data.pop("file", None)
        validated_data = self._resolve(validated_data, instance.organization)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                CostingItem.objects.create(costing=instance, **item_data)
        if files_data is not None:
            self._handle_files(instance, files_data, raw_files)
        return instance
