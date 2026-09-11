from rest_framework import serializers

from .models import Organization


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["id", "name", "slug", "logo", "primary_color", "tagline"]


class OrganizationSettingsSerializer(serializers.ModelSerializer):
    """Full read/write shape for the active organization's own settings
    screen — mirrors what the old standalone AppSettings singleton exposed,
    so the frontend Settings page works seamlessly with both shapes."""

    class Meta:
        model = Organization
        fields = [
            "id", "name", "slug", "logo", "primary_color", "tagline",
            "contact_email", "contact_phone", "address",
            "default_currency_code", "default_tax_percent",
            "order_prefix", "quotation_prefix", "quotation_intro", "quotation_terms",
            "quotation_signature_name", "quotation_designation", "quotation_contact_person",
            "quotation_background_image", "quotation_signature_image",
            "smtp_host", "smtp_port", "smtp_user", "smtp_password",
            "smtp_use_tls", "smtp_use_ssl", "smtp_from_email", "smtp_from_name",
            "notify_admin_email", "notify_on_new_order", "notify_on_order_delivered",
            "notify_on_quote_accepted", "notify_on_payment_received",
            "whatsapp_number", "whatsapp_default_country_code",
            "whatsapp_order_template", "whatsapp_quote_template", "whatsapp_payment_template",
        ]
        read_only_fields = ["id", "slug"]

    def to_internal_value(self, data):
        mutable_data = data.copy() if hasattr(data, "copy") else dict(data)

        # Map frontend legacy aliases to Organization model field names
        if "app_name" in mutable_data and not mutable_data.get("name"):
            mutable_data["name"] = mutable_data["app_name"]
        elif "company_name" in mutable_data and not mutable_data.get("name"):
            mutable_data["name"] = mutable_data["company_name"]

        if "app_logo" in mutable_data and not mutable_data.get("logo"):
            mutable_data["logo"] = mutable_data["app_logo"]

        if "company_email" in mutable_data and not mutable_data.get("contact_email"):
            mutable_data["contact_email"] = mutable_data["company_email"]

        if "company_phone" in mutable_data and not mutable_data.get("contact_phone"):
            mutable_data["contact_phone"] = mutable_data["company_phone"]

        if "company_address" in mutable_data and not mutable_data.get("address"):
            mutable_data["address"] = mutable_data["company_address"]

        return super().to_internal_value(mutable_data)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Expose legacy/convenience aliases expected by frontend types
        ret["app_name"] = ret.get("name") or ""
        ret["company_name"] = ret.get("name") or ""
        ret["app_logo"] = ret.get("logo")
        ret["company_email"] = ret.get("contact_email") or ""
        ret["company_phone"] = ret.get("contact_phone") or ""
        ret["company_address"] = ret.get("address") or ""
        return ret


class CommunicationLogSerializer(serializers.ModelSerializer):
    sent_by_name = serializers.CharField(source="sent_by.get_full_name", read_only=True)
    client_name = serializers.CharField(source="client.client_name", read_only=True)
    order_no = serializers.CharField(source="order.order_no", read_only=True)
    quotation_no = serializers.CharField(source="quotation.quotation_no", read_only=True)

    class Meta:
        from .models import CommunicationLog
        model = CommunicationLog
        fields = [
            "id", "channel", "recipient", "subject", "message", "status",
            "error_message", "sent_by", "sent_by_name", "client", "client_name",
            "order", "order_no", "quotation", "quotation_no", "created_at",
        ]
        read_only_fields = ["id", "created_at", "sent_by_name", "client_name", "order_no", "quotation_no"]
