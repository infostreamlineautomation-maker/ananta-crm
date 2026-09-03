from django.db.models import Prefetch
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.modules import NOTIFICATIONS
from apps.core.viewsets import ModuleViewSet
from apps.orders.views import can_view_all_orders

from .models import Notification, NotificationRead
from .serializers import NotificationSerializer


class NotificationViewSet(ModuleViewSet):
    """Read-mostly: notifications themselves are created by signals elsewhere
    (see apps.orders.signals), not by POSTing here."""

    serializer_class = NotificationSerializer
    module_name = NOTIFICATIONS
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = Notification.objects.filter(organization=self.request.organization).select_related(
            "order__client"
        ).prefetch_related(
            Prefetch("reads", queryset=NotificationRead.objects.filter(user=user), to_attr="my_reads")
        )
        if can_view_all_orders(user):
            return qs
        return qs.filter(order__created_by=user) | qs.filter(order__is_visible_to_staff=True)

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notification = self.get_object()
        row, _ = NotificationRead.objects.get_or_create(user=request.user, notification=notification)
        row.read_at = timezone.now()
        row.save(update_fields=["read_at"])
        return Response(self.get_serializer(notification).data)

    @action(detail=True, methods=["post"])
    def dismiss(self, request, pk=None):
        notification = self.get_object()
        row, _ = NotificationRead.objects.get_or_create(user=request.user, notification=notification)
        row.is_dismissed = True
        row.save(update_fields=["is_dismissed"])
        return Response(self.get_serializer(notification).data)
