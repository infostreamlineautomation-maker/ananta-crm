from rest_framework import serializers

from apps.catalog.models import Product
from apps.clients.models import Client
from apps.core.serializers import SameOrganizationFieldsMixin
from apps.suppliers.models import Supplier

from .models import Costing, CostingItem


class CostingItemSerializer(serializers.ModelSerializer):
    profit = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = CostingItem
        fields = ["id", "supplier_rate", "quantity", "client_rate", "profit"]


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
    supplier_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    product_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    client_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    supplier_display = serializers.CharField(source="supplier.supplier_name", read_only=True)
    product_display = serializers.CharField(source="product.product_name", read_only=True)
    client_display = serializers.CharField(source="client.client_name", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)

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
            "description", "items", "supplier_cost", "client_revenue", "profit", "profit_percent",
            "is_deleted", "created_by", "created_at", "updated_at",
        ]
        extra_kwargs = {"supplier": {"required": False}, "product": {"required": False}, "client": {"required": False}}
        read_only_fields = ["is_deleted", "created_by", "created_at", "updated_at"]

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("A costing sheet needs at least one line item.")
        return value

    def _resolve(self, validated_data, organization):
        # Fast-track lookups/creates must stay within the active organization —
        # otherwise a Meewa costing sheet could silently match (or create
        # duplicates of) an Ananta supplier/product/client by name.
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

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        organization = validated_data["organization"]
        validated_data = self._resolve(validated_data, organization)
        costing = Costing.objects.create(**validated_data)
        for item_data in items_data:
            CostingItem.objects.create(costing=costing, **item_data)
        return costing

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        validated_data = self._resolve(validated_data, instance.organization)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                CostingItem.objects.create(costing=instance, **item_data)
        return instance
