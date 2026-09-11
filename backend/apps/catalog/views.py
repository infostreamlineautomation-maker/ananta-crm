from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

from apps.core.filters import DynamicQueryFilterBackend
from apps.core.modules import CATALOG
from apps.core.viewsets import SoftDeleteModuleViewSet

from .models import Product
from .serializers import ProductSerializer


class ProductViewSet(SoftDeleteModuleViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    module_name = CATALOG
    filter_backends = [DjangoFilterBackend, SearchFilter, DynamicQueryFilterBackend]
    search_fields = ["product_name", "description"]
