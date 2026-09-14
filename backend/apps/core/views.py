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
        {"field_key": "gsm", "label": "GSM (Paper Weight)", "field_type": "number", "options": [], "default_value": "300", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 1},
        {"field_key": "paper_type", "label": "Paper / Material Type", "field_type": "select", "options": ["Art Card", "SBS Board", "Kraft Paper", "Maplitho Paper", "Duplex Board", "Vinyl", "Canvas"], "default_value": "Art Card", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 2},
        {"field_key": "lamination", "label": "Lamination / Coating", "field_type": "select", "options": ["None", "Gloss Thermal", "Matt Thermal", "Velvet / Soft Touch", "Spot UV", "Drip Off", "Aqueous"], "default_value": "Matt Thermal", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 3},
        {"field_key": "finishing", "label": "Finishing & Binding", "field_type": "select", "options": ["None", "Die Cutting", "Creasing / Folding", "Foil Stamping", "Embossing", "Perfect Binding", "Saddle Stitching"], "default_value": "Die Cutting", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 4},
    ],
    "quotation_item": [
        {"field_key": "material", "label": "Material & GSM", "field_type": "text", "options": [], "default_value": "350 GSM Art Board", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 1},
        {"field_key": "finishing", "label": "Finishing Details", "field_type": "text", "options": [], "default_value": "Matt Lamination + Spot UV", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 2},
        {"field_key": "delivery_days", "label": "Delivery Lead Time (Days)", "field_type": "number", "options": [], "default_value": "3", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 3},
    ],
    "costing_item": [
        {"field_key": "paper_cost", "label": "Paper / Material Cost", "field_type": "number", "options": [], "default_value": "0", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 1},
        {"field_key": "printing_charge", "label": "Plate & Printing Charge", "field_type": "number", "options": [], "default_value": "0", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 2},
        {"field_key": "lamination_cost", "label": "Lamination Charge", "field_type": "number", "options": [], "default_value": "0", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 3},
        {"field_key": "die_finishing_cost", "label": "Die & Finishing Charge", "field_type": "number", "options": [], "default_value": "0", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 4},
        {"field_key": "wastage_percent", "label": "Wastage Allowance %", "field_type": "number", "options": [], "default_value": "5", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 5},
        {"field_key": "machine_setup", "label": "Machine Setup Fee", "field_type": "number", "options": [], "default_value": "0", "is_required": False, "show_in_table": False, "show_in_print": True, "sort_order": 6},
    ],
    "product": [],
    "client": [],
    "company": [],
    "supplier": [],
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




