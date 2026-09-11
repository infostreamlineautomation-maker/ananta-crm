from rest_framework import serializers

from apps.core.serializers import SameOrganizationFieldsMixin

from .models import Client, ClientGroup, Company


class ClientGroupSerializer(serializers.ModelSerializer):
    clients_count = serializers.IntegerField(source="clients.count", read_only=True)

    class Meta:
        model = ClientGroup
        fields = [
            "id", "name", "description", "color", "clients", "clients_count",
            "is_deleted", "created_at", "updated_at",
        ]
        read_only_fields = ["is_deleted", "created_at", "updated_at"]


class CompanySerializer(serializers.ModelSerializer):
    country_name = serializers.CharField(source="country.name", read_only=True)

    class Meta:
        model = Company
        fields = [
            "id", "company_name", "contact_name", "vat_id", "reg_no",
            "contact_email", "contact_phone", "company_phone", "country", "country_name",
            "state", "city", "zip_code", "address", "facebook", "twitter", "linkedin",
            "remarks", "logo", "extra_data", "is_deleted", "created_at", "updated_at",
        ]
        read_only_fields = ["is_deleted", "created_at", "updated_at"]


class ClientSerializer(SameOrganizationFieldsMixin, serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.company_name", read_only=True)
    country_name = serializers.CharField(source="effective_country.name", read_only=True)
    currency_code = serializers.CharField(source="effective_country.currency_code", read_only=True)
    group_ids = serializers.PrimaryKeyRelatedField(many=True, read_only=True, source="groups")
    same_organization_fields = ["company"]

    class Meta:
        model = Client
        fields = [
            "id", "client_name", "client_type", "company", "company_name", "phone", "email",
            "address", "country", "country_name", "currency_code", "group_ids", "extra_data",
            "is_deleted", "created_at", "updated_at",
        ]
        read_only_fields = ["is_deleted", "created_at", "updated_at"]


