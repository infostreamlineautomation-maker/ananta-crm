from rest_framework import serializers

from .models import ActivityLog, Country, ExchangeRate


class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ["code", "name", "currency_code", "currency_symbol"]


class ExchangeRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExchangeRate
        fields = [
            "id",
            "source_currency",
            "target_currency",
            "rate",
            "market_rate",
            "is_manual_override",
            "last_synced_at",
        ]
        read_only_fields = ["id", "last_synced_at"]


class ActivityLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = ActivityLog
        fields = ["id", "user", "user_name", "module", "object_id", "action", "details", "created_at"]


class SameOrganizationFieldsMixin:
    """Declare `same_organization_fields = ["client", "project", ...]` on a
    serializer to reject any of those FK values that don't belong to the
    active organization.

    The UI's own pickers only ever list options from the org-scoped list
    endpoints, so this never fires in normal use — it closes off a direct-API
    cross-tenant reference (e.g. POSTing an Order with another organization's
    client id) that the UI itself never exposes but a raw request still
    could attempt."""

    same_organization_fields: list = []

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        organization = getattr(request, "organization", None)
        if organization is not None:
            for field in self.same_organization_fields:
                value = attrs.get(field)
                if value is not None and value.organization_id != organization.id:
                    raise serializers.ValidationError({field: f"That {field} doesn't belong to the active organization."})
        return attrs
