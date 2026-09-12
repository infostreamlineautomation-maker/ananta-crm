from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

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


