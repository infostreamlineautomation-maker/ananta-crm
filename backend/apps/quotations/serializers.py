from rest_framework import serializers

from apps.core.serializers import SameOrganizationFieldsMixin

from .models import Quotation, QuotationItem


class QuotationItemSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = QuotationItem
        fields = ["id", "description", "qty", "rate", "amount", "image", "extra_data", "sort_order"]


class QuotationSerializer(SameOrganizationFieldsMixin, serializers.ModelSerializer):
    items = QuotationItemSerializer(many=True)
    client_name = serializers.CharField(source="client.client_name", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    same_organization_fields = ["client", "project"]

    class Meta:
        model = Quotation
        fields = [
            "id", "quotation_no", "quotation_date", "client", "client_name", "project", "project_name", "to_name", "to_address",
            "subject", "intro_text", "notes", "footer_content", "col_qty_label", "col_rate_label",
            "columns_config", "currency_code", "exchange_rate", "base_currency_code", "status", "subtotal", "items",
            "is_deleted", "created_by", "created_at", "updated_at",
        ]
        read_only_fields = ["quotation_no", "is_deleted", "created_by", "created_at", "updated_at"]

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("A quotation needs at least one line item.")
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

        quotation = Quotation(**validated_data)
        quotation.quotation_no = next_number(organization, organization.quotation_prefix)
        quotation.save()
        for i, item_data in enumerate(items_data):
            QuotationItem.objects.create(quotation=quotation, sort_order=i, **item_data)
        return quotation

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
                QuotationItem.objects.create(quotation=instance, sort_order=i, **item_data)
        return instance


class QuotationToOrderSerializer(serializers.Serializer):
    """Input for "Create Order from this Quotation" — a one-off copy, not a
    stored link (see the audit's decision to keep the two modules independent)."""

    date = serializers.DateField()
    tax_percent = serializers.DecimalField(max_digits=5, decimal_places=2, default=0)
