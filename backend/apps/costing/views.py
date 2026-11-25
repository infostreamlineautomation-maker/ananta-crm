from decimal import Decimal
import django_filters
from django.db import transaction
from django.db.models import Case, DecimalField, ExpressionWrapper, F, Q, Sum, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response

from apps.core.filters import CRMOrderingFilter, DynamicQueryFilterBackend
from apps.core.modules import COSTING
from apps.core.viewsets import SoftDeleteModuleViewSet

from .models import Costing, CostingFile, CostingItem
from .serializers import CostingSerializer


class CostingFilter(django_filters.FilterSet):
    client_group = django_filters.NumberFilter(field_name="client__groups__id", distinct=True)
    company_name = django_filters.CharFilter(field_name="client__company__company_name", lookup_expr="icontains")
    product = django_filters.CharFilter(method="filter_product")
    product_name = django_filters.CharFilter(method="filter_product")

    class Meta:
        model = Costing
        fields = ["supplier", "client", "project", "client_group", "company_name"]

    def filter_product(self, queryset, name, value):
        val = (value or "").strip()
        if not val:
            return queryset
        if val.isdigit():
            return queryset.filter(Q(product_id=int(val)) | Q(items__product_id=int(val))).distinct()
        return queryset.filter(
            Q(product__product_name__icontains=val)
            | Q(items__product__product_name__icontains=val)
            | Q(items__product_name__icontains=val)
        ).distinct()


class CostingViewSet(SoftDeleteModuleViewSet):
    queryset = Costing.objects.select_related(
        "supplier", "product", "client", "client__company", "project"
    ).prefetch_related("items", "items__product", "files")
    serializer_class = CostingSerializer
    module_name = COSTING
    filter_backends = [DjangoFilterBackend, SearchFilter, CRMOrderingFilter, DynamicQueryFilterBackend]
    filterset_class = CostingFilter
    search_fields = [
        "description",
        "client__client_name",
        "client__company__company_name",
        "supplier__supplier_name",
        "product__product_name",
        "items__product__product_name",
        "items__product_name",
        "items__description",
        "project__name",
    ]

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

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        subquery = queryset.values("id")

        aggregates = CostingItem.objects.filter(costing_id__in=subquery).aggregate(
            total_supplier_cost=Coalesce(
                Sum(F("supplier_rate") * F("quantity"), output_field=DecimalField(max_digits=14, decimal_places=2)),
                Value(Decimal("0.00")),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
            total_client_revenue=Coalesce(
                Sum(F("client_rate") * F("quantity"), output_field=DecimalField(max_digits=14, decimal_places=2)),
                Value(Decimal("0.00")),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
        )
        total_supplier_cost = aggregates["total_supplier_cost"] or Decimal("0.00")
        total_client_revenue = aggregates["total_client_revenue"] or Decimal("0.00")
        total_profit = total_client_revenue - total_supplier_cost
        profit_percent = (
            round((total_profit / total_supplier_cost) * 100, 2)
            if total_supplier_cost > 0
            else Decimal("0.00")
        )

        org = getattr(self.request, "organization", None)
        base_curr = (getattr(org, "default_currency_code", "INR") or "INR").upper()

        costing_totals = {
            "base_currency": base_curr,
            "supplier_cost": str(round(total_supplier_cost, 2)),
            "client_revenue": str(round(total_client_revenue, 2)),
            "profit": str(round(total_profit, 2)),
            "profit_percent": str(profit_percent),
        }

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data["costing_totals"] = costing_totals
            return response

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            "results": serializer.data,
            "costing_totals": costing_totals,
        })

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def copy(self, request, pk=None):
        source = self.get_object()
        new_date = request.data.get("costing_date") or timezone.localdate()
        new_costing = Costing.objects.create(
            organization=source.organization,
            costing_date=new_date,
            project=source.project,
            supplier=source.supplier,
            product=source.product,
            client=source.client,
            file=source.file,
            file_name=source.file_name,
            description=source.description,
            columns_config=source.columns_config,
            created_by=request.user,
        )
        for item in source.items.all():
            CostingItem.objects.create(
                costing=new_costing,
                product=item.product,
                product_name=item.product_name,
                description=item.description,
                supplier_rate=item.supplier_rate,
                quantity=item.quantity,
                client_rate=item.client_rate,
                extra_data=item.extra_data,
                sort_order=item.sort_order,
            )
        for cf in source.files.all():
            CostingFile.objects.create(
                costing=new_costing,
                file=cf.file,
                file_name=cf.file_name,
                file_size=cf.file_size,
                category=cf.category,
            )

        from apps.core.models import ActivityLog
        try:
            ActivityLog.objects.create(
                user=request.user,
                module="costing",
                object_id=str(new_costing.id),
                action="created",
                details=f"Costing #{new_costing.id} cloned from Costing #{source.id}",
            )
        except Exception:
            pass

        return Response(CostingSerializer(new_costing, context={"request": request}).data, status=201)
