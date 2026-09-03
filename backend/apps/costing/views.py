from django_filters.rest_framework import DjangoFilterBackend

from apps.core.modules import COSTING
from apps.core.viewsets import SoftDeleteModuleViewSet

from .models import Costing
from .serializers import CostingSerializer


class CostingViewSet(SoftDeleteModuleViewSet):
    queryset = Costing.objects.select_related("supplier", "product", "client", "project").prefetch_related("items")
    serializer_class = CostingSerializer
    module_name = COSTING
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["supplier", "product", "client", "project"]
