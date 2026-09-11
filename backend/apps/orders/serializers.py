from rest_framework import serializers

from apps.core.serializers import SameOrganizationFieldsMixin

from .models import Order, OrderImage, OrderItem


class OrderImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderImage
        fields = ["id", "order", "image", "caption", "uploaded_at"]
        read_only_fields = ["uploaded_at"]


class OrderItemSerializer(SameOrganizationFieldsMixin, serializers.ModelSerializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    product_name = serializers.CharField(source="product.product_name", read_only=True)
    same_organization_fields = ["product"]

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product",
            "product_name",
            "description",
            "qty",
            "rate",
            "amount",
            "image",
            "extra_data",
            "sort_order",
        ]


class OrderSerializer(SameOrganizationFieldsMixin, serializers.ModelSerializer):
    """Items are nested and writable: POST/PUT accept an `items` array and this
    serializer replaces the item set and recalculates totals server-side —
    qty/rate/grand_total are never taken from the client as-is, closing the
    legacy app's "browser computes the total, server trusts it" flaw."""

    items = OrderItemSerializer(many=True)
    images = OrderImageSerializer(many=True, read_only=True)
    client_name = serializers.CharField(source="client.client_name", read_only=True)
    company_name = serializers.CharField(source="client.company.company_name", read_only=True, default=None)
    supplier_name = serializers.CharField(source="supplier.supplier_name", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)
    due_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    same_organization_fields = ["client", "project", "supplier"]

    class Meta:
        model = Order
        fields = [
            "id", "order_no", "date", "client", "client_name", "company_name", "project", "project_name",
            "project_title", "supplier", "supplier_name", "delivery_time",
            "description", "columns_config", "tax_percent", "subtotal", "tax_amount", "grand_total",
            "currency_code", "exchange_rate", "base_currency_code",
            "delivery_status", "payment_status", "paid_amount", "due_amount", "is_visible_to_staff",
            "copied_from", "created_by", "created_by_name", "items", "images", "created_at", "updated_at",
        ]
        read_only_fields = [
            "order_no", "subtotal", "tax_amount", "grand_total", "due_amount",
            "copied_from", "created_by", "created_at", "updated_at",
        ]


    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("An order needs at least one line item.")
        return value

    def _default_currency(self, client, organization):
        if client:
            country = client.effective_country
            if country:
                return country.currency_code
        return organization.default_currency_code

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        organization = validated_data["organization"]

        if not validated_data.get("currency_code"):
            validated_data["currency_code"] = self._default_currency(validated_data.get("client"), organization)

        from apps.core.forex import get_exchange_rate
        base_curr = organization.default_currency_code or "INR"
        validated_data["base_currency_code"] = base_curr
        if not validated_data.get("exchange_rate") or validated_data.get("exchange_rate") == 1:
            validated_data["exchange_rate"] = get_exchange_rate(validated_data["currency_code"], base_curr, organization)

        from apps.core.numbering import next_number

        order = Order(**validated_data)
        order.order_no = next_number(order.organization, getattr(order.organization, "order_prefix", "AG/"))
        order.save()
        for i, item_data in enumerate(items_data):
            OrderItem.objects.create(order=order, sort_order=i, **item_data)
        order.recalc_totals()

        from apps.notifications.models import Notification

        Notification.objects.create(
            organization=order.organization,
            event_type=Notification.ORDER_CREATED,
            title=f"New order {order.order_no}",
            message=f"{order.client.client_name} — {order.currency_code} {order.grand_total:,.2f}",
            order=order,
        )
        return order

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        organization = instance.organization
        if "currency_code" in validated_data and validated_data["currency_code"] != instance.currency_code:
            from apps.core.forex import get_exchange_rate
            base_curr = organization.default_currency_code or "INR"
            validated_data["exchange_rate"] = get_exchange_rate(validated_data["currency_code"], base_curr, organization)
            validated_data["base_currency_code"] = base_curr

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for i, item_data in enumerate(items_data):
                OrderItem.objects.create(order=instance, sort_order=i, **item_data)
            instance.recalc_totals()
        return instance


class OrderCopySerializer(serializers.Serializer):
    """Input for the "Copy Order" action — matches the legacy staff workflow:
    clone client/items from an existing order into a fresh one for review."""

    date = serializers.DateField()
