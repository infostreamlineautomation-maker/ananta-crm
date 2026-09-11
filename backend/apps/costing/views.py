from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

from apps.core.filters import DynamicQueryFilterBackend
from apps.core.modules import COSTING
from apps.core.viewsets import SoftDeleteModuleViewSet

from .models import Costing
from .serializers import CostingSerializer


class CostingViewSet(SoftDeleteModuleViewSet):
    queryset = Costing.objects.select_related("supplier", "product", "client", "project").prefetch_related("items")
    serializer_class = CostingSerializer
    module_name = COSTING
    filter_backends = [DjangoFilterBackend, SearchFilter, DynamicQueryFilterBackend]
    filterset_fields = ["supplier", "product", "client", "project"]
    search_fields = ["description", "client__client_name", "supplier__supplier_name", "product__product_name"]
