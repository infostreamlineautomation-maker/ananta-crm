from rest_framework.filters import SearchFilter

from apps.core.modules import CATALOG
from apps.core.viewsets import SoftDeleteModuleViewSet

from .models import Product
from .serializers import ProductSerializer


class ProductViewSet(SoftDeleteModuleViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    module_name = CATALOG
    filter_backends = [SearchFilter]
    search_fields = ["product_name"]
