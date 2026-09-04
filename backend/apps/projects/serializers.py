from django.db.models import Sum
from rest_framework import serializers

from apps.core.serializers import SameOrganizationFieldsMixin

from .models import Project


class ProjectSerializer(SameOrganizationFieldsMixin, serializers.ModelSerializer):
    """Orders/Quotations/Costings themselves aren't nested here — the frontend
    fetches them filtered by ?project=<id> from their own endpoints, which
    already carry all the CRUD/permission logic. This just exposes cheap
    summary counts for a project list/detail header."""

    client_name = serializers.CharField(source="client.client_name", read_only=True)
    orders_count = serializers.SerializerMethodField()
    quotations_count = serializers.SerializerMethodField()
    costings_count = serializers.SerializerMethodField()
    total_order_value = serializers.SerializerMethodField()
    same_organization_fields = ["client"]

    class Meta:
        model = Project
        fields = [
            "id", "name", "client", "client_name", "description", "status", "extra_data",
            "orders_count", "quotations_count", "costings_count", "total_order_value",
            "is_deleted", "created_by", "created_at", "updated_at",
        ]
        read_only_fields = ["is_deleted", "created_by", "created_at", "updated_at"]


    def get_orders_count(self, obj):
        return obj.orders.count()

    def get_quotations_count(self, obj):
        return obj.quotations.count()

    def get_costings_count(self, obj):
        return obj.costings.count()

    def get_total_order_value(self, obj):
        return obj.orders.aggregate(total=Sum("grand_total"))["total"] or 0
