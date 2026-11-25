from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

from apps.core.filters import CRMOrderingFilter, DynamicQueryFilterBackend
from apps.core.modules import PROJECTS
from apps.core.viewsets import SoftDeleteModuleViewSet

from .models import Project
from .serializers import ProjectSerializer


class ProjectViewSet(SoftDeleteModuleViewSet):
    queryset = Project.objects.select_related("client", "client__company").all()
    serializer_class = ProjectSerializer
    module_name = PROJECTS
    filter_backends = [DjangoFilterBackend, SearchFilter, CRMOrderingFilter, DynamicQueryFilterBackend]
    filterset_fields = ["client", "status"]
    search_fields = ["name", "description", "client__client_name", "client__company__company_name"]
