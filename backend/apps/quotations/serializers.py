import base64
import mimetypes
import uuid
from django.core.files.base import ContentFile
from rest_framework import serializers

from apps.core.serializers import SameOrganizationFieldsMixin

from .models import Quotation, QuotationAttachment, QuotationItem

MIME_TO_EXT = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-excel": ".xls",
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


class QuotationAttachmentSerializer(serializers.ModelSerializer):
    file = Base64OrURLFileField(required=False, allow_null=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = QuotationAttachment
        fields = ["id", "file", "file_name", "file_size", "file_type", "include_in_pdf", "annexure_title", "uploaded_at", "file_url"]
        read_only_fields = ["uploaded_at", "file_url"]

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None


class Base64OrURLImageField(serializers.ImageField):
    def to_internal_value(self, data):
        if not data:
            return None
        if isinstance(data, str):
            if data.startswith("data:image"):
                try:
                    format_prefix, imgstr = data.split(";base64,")
                    ext = format_prefix.split("/")[-1].split("+")[0]
                    if ext == "jpeg":
                        ext = "jpg"
                    file_name = f"{uuid.uuid4().hex}.{ext}"
                    return ContentFile(base64.b64decode(imgstr), name=file_name)
                except Exception:
                    raise serializers.ValidationError("Invalid base64 image data.")
            elif data.startswith("http://") or data.startswith("https://") or data.startswith("/media/") or data.startswith("media/"):
                return "__KEEP_EXISTING__"
        return super().to_internal_value(data)


class QuotationItemSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    product_name = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)
    image = Base64OrURLImageField(required=False, allow_null=True)

    class Meta:
        model = QuotationItem
        fields = [
            "id", "product", "product_name", "description", "qty", "rate",
            "supplier_rate", "profit", "margin_percent", "total_profit",
            "amount", "image", "extra_data", "sort_order"
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if instance.product:
            ret["product_name"] = instance.product.product_name
        return ret


class QuotationSerializer(SameOrganizationFieldsMixin, serializers.ModelSerializer):
    items = QuotationItemSerializer(many=True)
    attachments = QuotationAttachmentSerializer(many=True, required=False)
    client_name = serializers.CharField(source="client.client_name", read_only=True)
    company_name = serializers.CharField(source="client.company.company_name", read_only=True, default=None)
    client_address = serializers.CharField(source="client.address", read_only=True, default="")
    project_name = serializers.CharField(source="project.name", read_only=True)
    supplier_name = serializers.CharField(source="supplier.company_name", read_only=True, default=None)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_supplier_cost = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_profit = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    same_organization_fields = ["client", "project", "supplier"]

    class Meta:
        model = Quotation
        fields = [
            "id", "quotation_no", "quotation_date", "quote_format", "client", "client_name", "company_name", "client_address",
            "project", "project_name", "supplier", "supplier_name", "to_name", "to_address",
            "subject", "intro_text", "notes", "footer_content", "whatsapp_message", "admin_remarks", "attachments",
            "col_qty_label", "col_rate_label", "col_labels",
            "columns_config", "currency_code", "exchange_rate", "base_currency_code", "status",
            "subtotal", "total_supplier_cost", "total_profit", "items",
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

    def _handle_attachments(self, quotation, attachments_data, raw_attachments_list=None):
        if attachments_data is None:
            return
        kept_ids = set()
        raw_list = raw_attachments_list if isinstance(raw_attachments_list, list) else []
        for idx, att_data in enumerate(attachments_data):
            raw_item = raw_list[idx] if idx < len(raw_list) and isinstance(raw_list[idx], dict) else {}
            att_id = att_data.get("id") or raw_item.get("id")
            file_content = att_data.get("file")
            file_name = att_data.get("file_name", "") or raw_item.get("file_name", "")
            file_size = att_data.get("file_size") or raw_item.get("file_size")
            file_type = att_data.get("file_type", "") or raw_item.get("file_type", "")
            include_in_pdf = att_data.get("include_in_pdf", False) if "include_in_pdf" in att_data else raw_item.get("include_in_pdf", False)
            annexure_title = att_data.get("annexure_title", "") or raw_item.get("annexure_title", "")

            if att_id and QuotationAttachment.objects.filter(quotation=quotation, id=att_id).exists():
                qa = QuotationAttachment.objects.get(quotation=quotation, id=att_id)
                if file_content and file_content != "__KEEP_EXISTING__":
                    qa.file = file_content
                if file_name:
                    qa.file_name = file_name
                if file_size is not None:
                    qa.file_size = file_size
                if file_type:
                    qa.file_type = file_type
                qa.include_in_pdf = bool(include_in_pdf)
                qa.annexure_title = annexure_title or ""
                qa.save()
                kept_ids.add(qa.id)
            elif file_content and file_content != "__KEEP_EXISTING__":
                qa = QuotationAttachment.objects.create(
                    quotation=quotation,
                    file=file_content,
                    file_name=file_name,
                    file_size=file_size,
                    file_type=file_type,
                    include_in_pdf=bool(include_in_pdf),
                    annexure_title=annexure_title or "",
                )
                kept_ids.add(qa.id)

        quotation.attachments.exclude(id__in=kept_ids).delete()

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        attachments_data = validated_data.pop("attachments", None)
        raw_attachments = self.initial_data.get("attachments", [])
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
        quotation.quotation_no = next_number(organization, organization.quotation_prefix, doc_type="quotation")
        quotation.save()
        for i, item_data in enumerate(items_data):
            if item_data.get("image") == "__KEEP_EXISTING__":
                item_data["image"] = None
            prod_name = item_data.pop("product_name", None)
            item_data.pop("sort_order", None)
            if not item_data.get("product") and prod_name:
                from apps.catalog.models import Product
                prod, _ = Product.objects.get_or_create(
                    organization=organization,
                    product_name=prod_name.strip(),
                )
                item_data["product"] = prod
            QuotationItem.objects.create(quotation=quotation, sort_order=i, **item_data)
        self._handle_attachments(quotation, attachments_data, raw_attachments)
        return quotation

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        attachments_data = validated_data.pop("attachments", None)
        raw_attachments = self.initial_data.get("attachments", [])
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
            existing_items = list(instance.items.all())
            instance.items.all().delete()
            for i, item_data in enumerate(items_data):
                img = item_data.get("image")
                if img == "__KEEP_EXISTING__":
                    if i < len(existing_items) and existing_items[i].image:
                        item_data["image"] = existing_items[i].image
                    else:
                        item_data["image"] = None
                prod_name = item_data.pop("product_name", None)
                item_data.pop("sort_order", None)
                if not item_data.get("product") and prod_name:
                    from apps.catalog.models import Product
                    prod, _ = Product.objects.get_or_create(
                        organization=organization,
                        product_name=prod_name.strip(),
                    )
                    item_data["product"] = prod
                QuotationItem.objects.create(quotation=instance, sort_order=i, **item_data)
        self._handle_attachments(instance, attachments_data, raw_attachments)
        return instance


class QuotationToOrderSerializer(serializers.Serializer):
    """Input for "Create Order from this Quotation" — a one-off copy, not a
    stored link (see the audit's decision to keep the two modules independent)."""

    date = serializers.DateField()
    tax_percent = serializers.DecimalField(max_digits=5, decimal_places=2, default=0)
