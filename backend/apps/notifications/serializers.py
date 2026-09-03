from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    order_no = serializers.CharField(source="order.order_no", read_only=True)
    is_read = serializers.SerializerMethodField()
    is_dismissed = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "event_type", "title", "message", "order", "order_no", "created_at", "is_read", "is_dismissed"]

    def _read_row(self, obj):
        # NotificationViewSet.get_queryset() prefetches this filtered to the
        # current user as `my_reads`; fall back to a live query if accessed
        # without that prefetch (e.g. from the admin or a shell).
        if hasattr(obj, "my_reads"):
            return obj.my_reads[0] if obj.my_reads else None
        user = self.context["request"].user
        return obj.reads.filter(user=user).first()

    def get_is_read(self, obj):
        row = self._read_row(obj)
        return bool(row and row.read_at)

    def get_is_dismissed(self, obj):
        row = self._read_row(obj)
        return bool(row and row.is_dismissed)
