from django.db.models import Case, DecimalField, ExpressionWrapper, F, Sum, Value, When
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

from apps.core.filters import DynamicQueryFilterBackend
from apps.core.modules import COSTING
from apps.core.viewsets import SoftDeleteModuleViewSet

from .models import Costing
from .serializers import CostingSerializer


class CostingViewSet(SoftDeleteModuleViewSet):
    queryset = Costing.objects.select_related("supplier", "product", "client", "project").prefetch_related("items", "files")
    serializer_class = CostingSerializer
    module_name = COSTING
    filter_backends = [DjangoFilterBackend, SearchFilter, DynamicQueryFilterBackend]
    filterset_fields = ["supplier", "product", "client", "project"]
    search_fields = ["description", "client__client_name", "supplier__supplier_name", "product__product_name"]

    def get_queryset(self):
        qs = super().get_queryset()

        supplier_cost_expr = Coalesce(
            Sum(F("items__supplier_rate") * F("items__quantity"), output_field=DecimalField(max_digits=14, decimal_places=2)),
            Value(0, output_field=DecimalField(max_digits=14, decimal_places=2)),
        )
        client_revenue_expr = Coalesce(
            Sum(F("items__client_rate") * F("items__quantity"), output_field=DecimalField(max_digits=14, decimal_places=2)),
            Value(0, output_field=DecimalField(max_digits=14, decimal_places=2)),
        )

        qs = qs.annotate(
            annotated_supplier_cost=supplier_cost_expr,
            annotated_client_revenue=client_revenue_expr,
        ).annotate(
            annotated_profit=ExpressionWrapper(
                F("annotated_client_revenue") - F("annotated_supplier_cost"),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            )
        ).annotate(
            annotated_profit_percent=Case(
                When(
                    annotated_supplier_cost__gt=0,
                    then=ExpressionWrapper(
                        (F("annotated_profit") / F("annotated_supplier_cost")) * 100,
                        output_field=DecimalField(max_digits=10, decimal_places=2),
                    ),
                ),
                default=Value(0, output_field=DecimalField(max_digits=10, decimal_places=2)),
                output_field=DecimalField(max_digits=10, decimal_places=2),
            )
        )
        return qs.distinct()
