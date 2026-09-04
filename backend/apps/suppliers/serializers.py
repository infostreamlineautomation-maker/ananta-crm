from rest_framework import serializers

from apps.core.validators import validate_file_upload

from .models import Supplier, SupplierContact, SupplierFile, SupplierProduct

SUPPLIER_FILE_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "xls", "xlsx"]


class _SameOrgSupplierMixin:
    """These are child records addressed by a `supplier` id straight from the
    request body (not filtered through the org-scoped list the way the
    Supplier itself is), so it has to be checked explicitly here — otherwise
    a request could attach a contact/product/file to a supplier belonging to
    a *different* organization than the one currently active."""

    def validate_supplier(self, value):
        request = self.context["request"]
        if value.organization_id != request.organization.id:
            raise serializers.ValidationError("That supplier doesn't belong to the active organization.")
        return value


class SupplierContactSerializer(_SameOrgSupplierMixin, serializers.ModelSerializer):
    class Meta:
        model = SupplierContact
        fields = ["id", "supplier", "contact_name", "contact_number", "designation"]


class SupplierProductSerializer(_SameOrgSupplierMixin, serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.product_name", read_only=True)

    class Meta:
        model = SupplierProduct
        fields = ["id", "supplier", "product", "product_name"]

    def validate_product(self, value):
        request = self.context["request"]
        if value.organization_id != request.organization.id:
            raise serializers.ValidationError("That product doesn't belong to the active organization.")
        return value


class SupplierFileSerializer(_SameOrgSupplierMixin, serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source="uploaded_by.username", read_only=True)

    class Meta:
        model = SupplierFile
        fields = [
            "id", "supplier", "file_type", "file", "file_size", "mime_type",
            "uploaded_by", "uploaded_by_name", "uploaded_at",
        ]
        read_only_fields = ["file_size", "mime_type", "uploaded_by", "uploaded_at"]

    def validate_file(self, value):
        validate_file_upload(value, SUPPLIER_FILE_EXTENSIONS)
        return value


class SupplierSerializer(serializers.ModelSerializer):
    contacts = SupplierContactSerializer(many=True, read_only=True)
    supplier_products = SupplierProductSerializer(many=True, read_only=True)
    files = SupplierFileSerializer(many=True, read_only=True)

    class Meta:
        model = Supplier
        fields = [
            "id", "supplier_name", "owner_name_contact", "contact", "source",
            "address", "email", "website", "remark", "extra_data", "is_deleted",
            "contacts", "supplier_products", "files", "created_at", "updated_at",
        ]
        read_only_fields = ["is_deleted", "created_at", "updated_at"]


    def validate(self, attrs):
        # Ports the legacy duplicate-supplier guard (name OR contact match),
        # scoped to the active organization — Ananta and Meewa can each have
        # their own supplier by the same name without tripping this.
        name = attrs.get("supplier_name")
        contact = attrs.get("contact")
        organization = self.instance.organization if self.instance else self.context["request"].organization
        qs = Supplier.objects.filter(is_deleted=False, organization=organization)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if name and qs.filter(supplier_name__iexact=name).exists():
            raise serializers.ValidationError({"supplier_name": "A supplier with this name already exists."})
        if contact and qs.filter(contact=contact).exists():
            raise serializers.ValidationError({"contact": "A supplier with this contact already exists."})
        return attrs
