from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .forex import get_exchange_rate, sync_exchange_rates
from .models import ActivityLog, Country, CustomFieldDefinition, ExchangeRate
from .serializers import (
    ActivityLogSerializer,
    CountrySerializer,
    CustomFieldDefinitionSerializer,
    ExchangeRateSerializer,
)


class CountryViewSet(viewsets.ReadOnlyModelViewSet):
    """Plain reference data — any authenticated user can read it, no module
    permission gate needed."""

    queryset = Country.objects.all()
    serializer_class = CountrySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None


class ExchangeRateViewSet(viewsets.ModelViewSet):
    serializer_class = ExchangeRateSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        org = getattr(self.request, "organization", None)
        base_curr = org.default_currency_code.upper() if org else "INR"
        qs = ExchangeRate.objects.filter(organization=org, target_currency=base_curr)
        if not qs.exists():
            sync_exchange_rates(org)
            qs = ExchangeRate.objects.filter(organization=org, target_currency=base_curr)
        return qs.order_by("source_currency")

    @action(detail=False, methods=["post"])
    def sync(self, request):
        """Forces live sync from forex provider."""
        org = getattr(request, "organization", None)
        synced = sync_exchange_rates(org)
        serializer = self.get_serializer(synced, many=True)
        return Response(
            {
                "message": f"Successfully updated live exchange rates against {org.default_currency_code if org else 'INR'}.",
                "rates": serializer.data,
            }
        )

    @action(detail=False, methods=["post"])
    def override(self, request):
        """Sets or resets a manual custom rate for a currency pair."""
        org = getattr(request, "organization", None)
        base_curr = (org.default_currency_code if org else "INR").upper()
        source_curr = request.data.get("source_currency", "").upper()
        rate_val = request.data.get("rate")
        reset_to_market = request.data.get("reset_to_market", False)

        if not source_curr:
            return Response({"error": "source_currency is required"}, status=400)

        rate_obj = ExchangeRate.objects.filter(
            organization=org, source_currency=source_curr, target_currency=base_curr
        ).first()

        if not rate_obj:
            sync_exchange_rates(org)
            rate_obj = ExchangeRate.objects.filter(
                organization=org, source_currency=source_curr, target_currency=base_curr
            ).first()

        if not rate_obj:
            return Response({"error": f"Currency {source_curr} not supported"}, status=404)

        if reset_to_market:
            rate_obj.rate = rate_obj.market_rate
            rate_obj.is_manual_override = False
        else:
            if rate_val is None or float(rate_val) <= 0:
                return Response({"error": "A valid positive rate is required"}, status=400)
            rate_obj.rate = rate_val
            rate_obj.is_manual_override = True

        rate_obj.save()
        return Response(self.get_serializer(rate_obj).data)


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Filter with ?module=suppliers&object_id=3 — any authenticated user can
    read it (it's an audit trail, not sensitive business data), no module
    permission gate needed."""

    queryset = ActivityLog.objects.select_related("user").all()
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["module", "object_id"]


from django_filters import rest_framework as filters


MODULE_ALIASES = {
    "quotation": "quotation_item",
    "quotations": "quotation_item",
    "quote": "quotation_item",
    "order": "order_item",
    "orders": "order_item",
    "costing": "costing_item",
    "costings": "costing_item",
    "client": "client",
    "clients": "client",
    "company": "company",
    "companies": "company",
    "supplier": "supplier",
    "suppliers": "supplier",
    "product": "product",
    "products": "product",
    "project": "project",
    "projects": "project",
}


class CustomFieldFilterSet(filters.FilterSet):
    module = filters.CharFilter(method="filter_module")

    class Meta:
        model = CustomFieldDefinition
        fields = ["module", "is_required", "show_in_table", "show_in_print"]

    def filter_module(self, queryset, name, value):
        if not value:
            return queryset
        val_lower = str(value).lower().strip()
        canonical = MODULE_ALIASES.get(val_lower, val_lower)
        return queryset.filter(module__in=[value, val_lower, canonical])


DEFAULT_CUSTOM_FIELDS = {
    "order_item": [
        # Main Order / Project System Columns
        {"field_key": "order_no", "label": "Project No / Order No", "field_type": "text", "options": [], "default_value": "", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 1},
        {"field_key": "project_title", "label": "Project Name / Title", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 2},
        {"field_key": "images", "label": "Proof / Artwork Images", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 3},
        {"field_key": "date", "label": "Order Date", "field_type": "date", "options": [], "default_value": "", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 4},
        {"field_key": "client_name", "label": "Client Name", "field_type": "text", "options": [], "default_value": "", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 5},
        {"field_key": "company_name", "label": "Company / Branch", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 6},
        {"field_key": "supplier_name", "label": "Supplier / Vendor", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": False, "sort_order": 7},
        {"field_key": "delivery_time", "label": "Delivery Deadline / Time", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 8},
        {"field_key": "currency_code", "label": "Currency Code", "field_type": "select", "options": ["INR", "AED", "USD", "EUR", "GBP"], "default_value": "INR", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 9},
        {"field_key": "subtotal", "label": "Total (Without GST)", "field_type": "number", "options": [], "default_value": "0", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 10},
        {"field_key": "tax_percent", "label": "GST % Rate", "field_type": "number", "options": [], "default_value": "18", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 11},
        {"field_key": "tax_amount", "label": "GST Tax Amount", "field_type": "number", "options": [], "default_value": "0.00", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 12},
        {"field_key": "grand_total", "label": "Total Amount (With GST)", "field_type": "number", "options": [], "default_value": "0.00", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 13},
        {"field_key": "paid_amount", "label": "Paid / Advance Amount", "field_type": "number", "options": [], "default_value": "0.00", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 14},
        {"field_key": "due_amount", "label": "Balance Due Amount", "field_type": "number", "options": [], "default_value": "0.00", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 15},
        {"field_key": "delivery_status", "label": "Delivery Status", "field_type": "select", "options": ["Pending", "In Progress", "Ready", "Dispatched", "Delivered", "Cancelled"], "default_value": "Pending", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 16},
        {"field_key": "payment_status", "label": "Payment Status", "field_type": "select", "options": ["Unpaid", "Partial", "Paid", "Overdue", "Refunded"], "default_value": "Unpaid", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 17},
        {"field_key": "remarks", "label": "Remarks / Notes", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 18},
        # Line Item Attributes
        {"field_key": "gsm", "label": "GSM (Paper Weight)", "field_type": "number", "options": [], "default_value": "300", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 19},
        {"field_key": "paper_type", "label": "Paper / Material Type", "field_type": "select", "options": ["Art Card", "SBS Board", "Kraft Paper", "Maplitho Paper", "Duplex Board", "Vinyl", "Canvas"], "default_value": "Art Card", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 20},
        {"field_key": "size", "label": "Size / Dimensions", "field_type": "text", "options": [], "default_value": "10 x 15 inch", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 21},
        {"field_key": "lamination", "label": "Lamination / Coating", "field_type": "select", "options": ["None", "Gloss Thermal", "Matt Thermal", "Velvet / Soft Touch", "Spot UV", "Drip Off", "Aqueous"], "default_value": "Matt Thermal", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 22},
        {"field_key": "hsn_code", "label": "HSN / SAC Code", "field_type": "text", "options": [], "default_value": "4911", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 23},
        {"field_key": "colors", "label": "Print Colors", "field_type": "select", "options": ["Single Color", "2 Colors", "4 Colors (CMYK)", "CMYK + 1 Pantone", "Multi-color"], "default_value": "4 Colors (CMYK)", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 24},
        {"field_key": "finishing", "label": "Finishing & Binding", "field_type": "select", "options": ["None", "Die Cutting", "Creasing / Folding", "Foil Stamping", "Embossing", "Perfect Binding", "Saddle Stitching"], "default_value": "Die Cutting", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 25},
    ],
    "quotation_item": [
        # Main Quotation System Columns
        {"field_key": "quotation_no", "label": "Quotation No", "field_type": "text", "options": [], "default_value": "", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 1},
        {"field_key": "quotation_date", "label": "Quotation Date", "field_type": "date", "options": [], "default_value": "", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 2},
        {"field_key": "status", "label": "Quotation Status", "field_type": "select", "options": ["Draft", "Sent", "Accepted", "Rejected", "Expired"], "default_value": "Draft", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 3},
        {"field_key": "client_name", "label": "Client Name", "field_type": "text", "options": [], "default_value": "", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 4},
        {"field_key": "company_name", "label": "Company Name", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 5},
        {"field_key": "to_name", "label": "Recipient Name (To)", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 6},
        {"field_key": "to_address", "label": "Recipient Address", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 7},
        {"field_key": "subject", "label": "Quotation Subject", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 8},
        {"field_key": "intro_text", "label": "Introductory Reference Text", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 9},
        {"field_key": "currency_code", "label": "Currency Code", "field_type": "select", "options": ["INR", "AED", "USD", "EUR", "GBP"], "default_value": "INR", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 10},
        {"field_key": "subtotal", "label": "Subtotal / Amount", "field_type": "number", "options": [], "default_value": "0.00", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 11},
        {"field_key": "tax_percent", "label": "Tax % Rate", "field_type": "number", "options": [], "default_value": "18", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 12},
        {"field_key": "tax_amount", "label": "Tax Amount", "field_type": "number", "options": [], "default_value": "0.00", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 13},
        {"field_key": "total_amount", "label": "Total Amount", "field_type": "number", "options": [], "default_value": "0.00", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 14},
        {"field_key": "notes", "label": "Terms & Conditions / Notes", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 15},
        # Line Item Attributes
        {"field_key": "size", "label": "Size / Dimensions", "field_type": "text", "options": [], "default_value": "Standard", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 16},
        {"field_key": "material", "label": "Material & GSM", "field_type": "text", "options": [], "default_value": "350 GSM Art Board", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 17},
        {"field_key": "finishing", "label": "Finishing Details", "field_type": "text", "options": [], "default_value": "Matt Lamination + Spot UV", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 18},
        {"field_key": "delivery_days", "label": "Delivery Lead Time (Days)", "field_type": "number", "options": [], "default_value": "3", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 19},
        {"field_key": "hsn_code", "label": "HSN Code", "field_type": "text", "options": [], "default_value": "4911", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 20},
    ],
    "costing_item": [
        # Main Costing System Columns
        {"field_key": "date", "label": "Costing Date", "field_type": "date", "options": [], "default_value": "", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 1},
        {"field_key": "client", "label": "Client Name", "field_type": "text", "options": [], "default_value": "", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 2},
        {"field_key": "project_name", "label": "Project Name", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 3},
        {"field_key": "file", "label": "Attachment / Artwork", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": False, "sort_order": 4},
        {"field_key": "supplier", "label": "Supplier / Vendor", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": False, "sort_order": 5},
        {"field_key": "product", "label": "Product / Item", "field_type": "text", "options": [], "default_value": "", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 6},
        {"field_key": "quantity", "label": "Quantity", "field_type": "number", "options": [], "default_value": "1", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 7},
        {"field_key": "supplier_rate", "label": "Supplier Unit Rate", "field_type": "number", "options": [], "default_value": "0.00", "is_required": False, "show_in_table": True, "show_in_print": False, "sort_order": 8},
        {"field_key": "client_rate", "label": "Client Quoted Rate", "field_type": "number", "options": [], "default_value": "0.00", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 9},
        {"field_key": "supplier_cost", "label": "Supplier Total Cost", "field_type": "number", "options": [], "default_value": "0.00", "is_required": False, "show_in_table": False, "show_in_print": False, "sort_order": 10},
        {"field_key": "client_revenue", "label": "Client Total Revenue", "field_type": "number", "options": [], "default_value": "0.00", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 11},
        {"field_key": "profit", "label": "Profit Amount", "field_type": "number", "options": [], "default_value": "0.00", "is_required": False, "show_in_table": True, "show_in_print": False, "sort_order": 12},
        {"field_key": "profit_percent", "label": "Profit Margin %", "field_type": "number", "options": [], "default_value": "0.00", "is_required": False, "show_in_table": True, "show_in_print": False, "sort_order": 13},
        {"field_key": "description", "label": "Remarks / Notes", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 14},
        # Costing Breakdown Elements
        {"field_key": "paper_cost", "label": "Paper / Material Cost", "field_type": "number", "options": [], "default_value": "0", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 15},
        {"field_key": "printing_charge", "label": "Plate & Printing Charge", "field_type": "number", "options": [], "default_value": "0", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 16},
        {"field_key": "lamination_cost", "label": "Lamination Charge", "field_type": "number", "options": [], "default_value": "0", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 17},
        {"field_key": "die_finishing_cost", "label": "Die & Finishing Charge", "field_type": "number", "options": [], "default_value": "0", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 18},
        {"field_key": "wastage_percent", "label": "Wastage Allowance %", "field_type": "number", "options": [], "default_value": "5", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 19},
        {"field_key": "machine_setup", "label": "Machine Setup Fee", "field_type": "number", "options": [], "default_value": "0", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 20},
    ],
    "product": [
        {"field_key": "product_name", "label": "Product Name", "field_type": "text", "options": [], "default_value": "", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 1},
        {"field_key": "description", "label": "Product Description", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 2},
        {"field_key": "category", "label": "Product Category", "field_type": "select", "options": ["Brochures & Flyers", "Boxes & Packaging", "Business Cards", "Labels & Stickers", "Banners & Flex", "Stationery", "Custom Novelties"], "default_value": "Brochures & Flyers", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 3},
        {"field_key": "standard_unit", "label": "Unit of Measurement (UOM)", "field_type": "select", "options": ["Pcs", "Box", "Kg", "Ream", "Meter", "Sq. Ft", "Set"], "default_value": "Pcs", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 4},
        {"field_key": "hsn_code", "label": "HSN / SAC Code", "field_type": "text", "options": [], "default_value": "4911", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 5},
        {"field_key": "min_order_qty", "label": "Minimum Order Qty (MOQ)", "field_type": "number", "options": [], "default_value": "100", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 6},
        {"field_key": "standard_gsm", "label": "Standard Paper GSM", "field_type": "text", "options": [], "default_value": "300 GSM", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 7},
        {"field_key": "base_price", "label": "Standard Base Price", "field_type": "number", "options": [], "default_value": "0.00", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 8},
        {"field_key": "lead_time_days", "label": "Standard Lead Time (Days)", "field_type": "number", "options": [], "default_value": "2", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 9},
    ],
    "client": [
        {"field_key": "client_name", "label": "Client Name", "field_type": "text", "options": [], "default_value": "", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 1},
        {"field_key": "client_type", "label": "Client Tier / Classification", "field_type": "select", "options": ["Tier A (VIP / High Volume)", "Tier B (Regular)", "Tier C (Occasional)"], "default_value": "Tier B (Regular)", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 2},
        {"field_key": "company_name", "label": "Company / Organization", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 3},
        {"field_key": "phone", "label": "Primary Phone Number", "field_type": "text", "options": [], "default_value": "", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 4},
        {"field_key": "email", "label": "Email Address", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 5},
        {"field_key": "address", "label": "Billing & Shipping Address", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 6},
        {"field_key": "country_name", "label": "Country", "field_type": "text", "options": [], "default_value": "India", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 7},
        {"field_key": "groups", "label": "Client Group / Category", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": False, "sort_order": 8},
        {"field_key": "currency_code", "label": "Billing Currency", "field_type": "select", "options": ["INR", "AED", "USD", "EUR", "GBP"], "default_value": "INR", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 9},
        {"field_key": "gstin", "label": "GSTIN / Tax Registration No", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 10},
        {"field_key": "pan_number", "label": "PAN Card Number", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 11},
        {"field_key": "credit_limit", "label": "Credit Limit (₹ / AED)", "field_type": "number", "options": [], "default_value": "50000", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 12},
        {"field_key": "payment_terms", "label": "Payment Terms", "field_type": "select", "options": ["Immediate / Cash", "15 Days", "30 Days", "45 Days", "60 Days", "50% Advance Balance on Delivery"], "default_value": "30 Days", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 13},
        {"field_key": "sales_territory", "label": "Sales Territory / Region", "field_type": "select", "options": ["North Zone", "South Zone", "East Zone", "West Zone", "Central Zone", "International"], "default_value": "West Zone", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 14},
        {"field_key": "contact_person", "label": "Alternate Contact Person", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 15},
    ],
    "company": [
        {"field_key": "logo", "label": "Company Logo", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 1},
        {"field_key": "company_name", "label": "Company Name", "field_type": "text", "options": [], "default_value": "", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 2},
        {"field_key": "contact_name", "label": "Contact Person", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 3},
        {"field_key": "gstin", "label": "GSTIN / VAT ID", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 4},
        {"field_key": "msin_number", "label": "MSIN / MSME Number", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 5},
        {"field_key": "reg_no", "label": "Registration No / CIN", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 6},
        {"field_key": "contact_email", "label": "Contact Email", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 7},
        {"field_key": "contact_phone", "label": "Contact Phone Number", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 8},
        {"field_key": "company_phone", "label": "Company Landline Phone", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 9},
        {"field_key": "country_name", "label": "Country", "field_type": "text", "options": [], "default_value": "India", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 10},
        {"field_key": "state", "label": "State / Province", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 11},
        {"field_key": "city", "label": "City", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 12},
        {"field_key": "zip_code", "label": "Postal / Zip Code", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 13},
        {"field_key": "address", "label": "Registered Address", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 14},
        {"field_key": "bank_name", "label": "Primary Bank Name", "field_type": "text", "options": [], "default_value": "HDFC Bank", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 15},
        {"field_key": "bank_account_no", "label": "Bank Account Number", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 16},
        {"field_key": "bank_ifsc", "label": "Bank IFSC / SWIFT Code", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 17},
        {"field_key": "branch_code", "label": "Branch Location / Code", "field_type": "text", "options": [], "default_value": "Main Branch", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 18},
        {"field_key": "facebook", "label": "Facebook Page", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": False, "sort_order": 19},
        {"field_key": "twitter", "label": "Twitter / X Profile", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": False, "sort_order": 20},
        {"field_key": "linkedin", "label": "LinkedIn Profile", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": False, "sort_order": 21},
        {"field_key": "remarks", "label": "Remarks / Internal Notes", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": False, "sort_order": 22},
    ],
    "supplier": [
        {"field_key": "name", "label": "Supplier / Vendor Name", "field_type": "text", "options": [], "default_value": "", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 1},
        {"field_key": "contact_person", "label": "Contact Person Name", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 2},
        {"field_key": "phone", "label": "Phone Number", "field_type": "text", "options": [], "default_value": "", "is_required": True, "show_in_table": True, "show_in_print": True, "sort_order": 3},
        {"field_key": "email", "label": "Email Address", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 4},
        {"field_key": "city", "label": "City", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 5},
        {"field_key": "state", "label": "State / Province", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 6},
        {"field_key": "country", "label": "Country", "field_type": "text", "options": [], "default_value": "India", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 7},
        {"field_key": "address", "label": "Office / Warehouse Address", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 8},
        {"field_key": "gstin", "label": "Supplier GSTIN / Tax ID", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 9},
        {"field_key": "pan_number", "label": "PAN Card Number", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 10},
        {"field_key": "bank_name", "label": "Bank Name", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 11},
        {"field_key": "bank_account_no", "label": "Bank Account Number", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 12},
        {"field_key": "bank_ifsc", "label": "Bank IFSC Code", "field_type": "text", "options": [], "default_value": "", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 13},
        {"field_key": "payment_terms", "label": "Payment Terms", "field_type": "select", "options": ["Immediate / Cash", "7 Days", "15 Days", "30 Days", "45 Days", "60 Days"], "default_value": "30 Days", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 14},
        {"field_key": "material_categories", "label": "Supplied Materials / Services", "field_type": "text", "options": [], "default_value": "Paper, Inks, Plates, Coatings, Bindery", "is_required": False, "show_in_table": True, "show_in_print": True, "sort_order": 15},
        {"field_key": "credit_period_days", "label": "Credit Period (Days)", "field_type": "number", "options": [], "default_value": "30", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 16},
    ],
}


def seed_default_custom_fields(org, module=None, replace=False):
    if not org:
        return []
    modules_to_seed = (
        [module]
        if module and module in DEFAULT_CUSTOM_FIELDS
        else list(DEFAULT_CUSTOM_FIELDS.keys())
    )
    seeded_fields = []
    for mod in modules_to_seed:
        field_list = DEFAULT_CUSTOM_FIELDS.get(mod, [])
        if replace:
            CustomFieldDefinition.objects.filter(organization=org, module=mod).delete()
        for idx, item in enumerate(field_list):
            field, created = CustomFieldDefinition.objects.get_or_create(
                organization=org,
                module=mod,
                field_key=item["field_key"],
                defaults={
                    "label": item["label"],
                    "field_type": item["field_type"],
                    "options": item.get("options", []),
                    "default_value": item.get("default_value", ""),
                    "is_required": item.get("is_required", False),
                    "show_in_table": item.get("show_in_table", True),
                    "show_in_print": item.get("show_in_print", True),
                    "sort_order": item.get("sort_order", idx + 1),
                },
            )
            seeded_fields.append(field)
    return seeded_fields


class CustomFieldDefinitionViewSet(viewsets.ModelViewSet):
    serializer_class = CustomFieldDefinitionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_class = CustomFieldFilterSet
    pagination_class = None

    def get_queryset(self):
        org = getattr(self.request, "organization", None)
        if not org:
            return CustomFieldDefinition.objects.none()

        # If this organization has zero custom fields for a requested module (or overall), auto-seed standard defaults
        req_module = self.request.query_params.get("module")
        if req_module:
            canonical = MODULE_ALIASES.get(req_module.lower().strip(), req_module.lower().strip())
            if not CustomFieldDefinition.objects.filter(organization=org, module=canonical).exists():
                seed_default_custom_fields(org, module=canonical)
        elif not CustomFieldDefinition.objects.filter(organization=org).exists():
            seed_default_custom_fields(org)

        return CustomFieldDefinition.objects.filter(organization=org).order_by("sort_order", "id")

    def perform_create(self, serializer):
        org = getattr(self.request, "organization", None)
        serializer.save(organization=org, created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=False, methods=["post"], url_path="reset-defaults")
    def reset_defaults(self, request):
        """Allows admin to reset or restore default industry standard columns for a specific tab or all tabs."""
        org = getattr(request, "organization", None)
        if not org:
            return Response({"error": "No active organization found."}, status=400)

        module = request.data.get("module")
        replace = request.data.get("replace", True)
        if module:
            module = MODULE_ALIASES.get(module.lower().strip(), module.lower().strip())

        seeded = seed_default_custom_fields(org, module=module, replace=replace)
        qs = CustomFieldDefinition.objects.filter(organization=org)
        if module:
            qs = qs.filter(module=module)
        serializer = self.get_serializer(qs.order_by("sort_order", "id"), many=True)
        return Response(
            {
                "message": f"Successfully loaded standard default columns{' for ' + module if module else ''}.",
                "fields": serializer.data,
            }
        )


class QuickSearchView(APIView):
    """Ultra-fast, unified global search across Orders, Clients, Quotations, Products, and Companies."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query or len(query) < 2:
            return Response({"results": [], "counts": {}, "groups": {}})

        org = getattr(request, "organization", None)
        if not org:
            return Response({"results": [], "counts": {}, "groups": {}})

        from apps.orders.models import Order
        from apps.clients.models import Client, Company
        from apps.quotations.models import Quotation
        from apps.catalog.models import Product

        # 1. Orders
        order_qs = (
            Order.objects.filter(organization=org)
            .filter(
                Q(order_no__icontains=query)
                | Q(project_title__icontains=query)
                | Q(client__client_name__icontains=query)
                | Q(client__company__company_name__icontains=query)
            )
            .select_related("client", "client__company")
            .order_by("-id")[:5]
        )
        orders = [
            {
                "type": "order",
                "id": o.id,
                "title": o.order_no,
                "subtitle": f"{o.project_title or o.client.client_name} • {o.currency_code} {int(o.grand_total):,}",
                "tag": o.delivery_status,
                "url": f"/orders/{o.id}",
            }
            for o in order_qs
        ]

        # 2. Clients
        client_qs = (
            Client.objects.filter(organization=org, is_deleted=False)
            .filter(
                Q(client_name__icontains=query)
                | Q(company__company_name__icontains=query)
                | Q(phone__icontains=query)
                | Q(email__icontains=query)
            )
            .select_related("company")
            .order_by("client_name")[:4]
        )
        clients = [
            {
                "type": "client",
                "id": c.id,
                "title": c.client_name,
                "subtitle": f"{c.company.company_name + ' • ' if c.company else ''}{c.phone or c.email or 'Client'}",
                "tag": f"Type {c.client_type}",
                "url": f"/clients/{c.id}",
            }
            for c in client_qs
        ]

        # 3. Quotations
        quote_qs = (
            Quotation.objects.filter(organization=org, is_deleted=False)
            .filter(
                Q(quotation_no__icontains=query)
                | Q(subject__icontains=query)
                | Q(client_name__icontains=query)
                | Q(company_name__icontains=query)
            )
            .order_by("-id")[:4]
        )
        quotations = [
            {
                "type": "quotation",
                "id": q.id,
                "title": q.quotation_no,
                "subtitle": f"{q.subject or q.client_name or q.company_name or 'Quotation'} • {q.currency_code} {int(q.grand_total):,}",
                "tag": q.status,
                "url": f"/quotations/{q.id}",
            }
            for q in quote_qs
        ]

        # 4. Products / Catalog
        product_qs = (
            Product.objects.filter(organization=org, is_deleted=False)
            .filter(Q(product_name__icontains=query) | Q(description__icontains=query))
            .order_by("product_name")[:4]
        )
        products = [
            {
                "type": "product",
                "id": p.id,
                "title": p.product_name,
                "subtitle": p.description[:60] if p.description else "Catalog item",
                "tag": "Product",
                "url": f"/products?search={p.product_name}",
            }
            for p in product_qs
        ]

        # 5. Companies
        company_qs = (
            Company.objects.filter(organization=org, is_deleted=False)
            .filter(
                Q(company_name__icontains=query)
                | Q(contact_name__icontains=query)
                | Q(company_phone__icontains=query)
                | Q(contact_email__icontains=query)
            )
            .order_by("company_name")[:3]
        )
        companies = [
            {
                "type": "company",
                "id": co.id,
                "title": co.company_name,
                "subtitle": f"{co.contact_name + ' • ' if co.contact_name else ''}{co.company_phone or co.contact_email or 'Company'}",
                "tag": "Company",
                "url": f"/companies/{co.id}",
            }
            for co in company_qs
        ]

        all_results = orders + clients + quotations + products + companies
        return Response(
            {
                "query": query,
                "total": len(all_results),
                "results": all_results,
                "counts": {
                    "orders": len(orders),
                    "clients": len(clients),
                    "quotations": len(quotations),
                    "products": len(products),
                    "companies": len(companies),
                },
                "groups": {
                    "orders": orders,
                    "clients": clients,
                    "quotations": quotations,
                    "products": products,
                    "companies": companies,
                },
            }
        )




