from rest_framework import serializers

from .models import Role, RolePermission, User


class RolePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RolePermission
        fields = [
            "id",
            "module",
            "can_view",
            "can_add",
            "can_edit",
            "can_delete",
            "can_submit",
            "can_cancel",
            "can_print",
            "can_export",
            "apply_user_permissions",
            "only_if_creator",
            "permlevel",
        ]


class RoleSerializer(serializers.ModelSerializer):
    permissions = RolePermissionSerializer(many=True, read_only=True)
    user_count = serializers.IntegerField(source="users.count", read_only=True)

    class Meta:
        model = Role
        fields = ["id", "name", "description", "is_system", "permissions", "user_count"]


class UserSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source="role.name", read_only=True)
    linked_client_name = serializers.CharField(source="linked_client.client_name", read_only=True)
    linked_client_company_name = serializers.CharField(source="linked_client.company.company_name", read_only=True, default=None)
    organization_id = serializers.SerializerMethodField()
    organization_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email", "phone",
            "user_type", "linked_client", "linked_client_name", "linked_client_company_name", "is_portal_client",
            "organization_id", "organization_name",
            "role", "role_name", "is_active", "is_superuser", "date_joined",
        ]
        read_only_fields = ["date_joined", "is_portal_client"]

    def get_organization_id(self, obj):
        if getattr(obj, "is_portal_client", False) and getattr(obj, "linked_client", None) and obj.linked_client.organization_id:
            return obj.linked_client.organization_id
        mem = obj.organization_memberships.first()
        return mem.organization_id if mem else None

    def get_organization_name(self, obj):
        if getattr(obj, "is_portal_client", False) and getattr(obj, "linked_client", None) and getattr(obj.linked_client, "organization", None):
            return obj.linked_client.organization.name
        mem = obj.organization_memberships.first()
        return mem.organization.name if mem else None


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    organization_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email", "phone",
            "user_type", "linked_client", "role", "password", "organization_id",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")
        org_id = validated_data.pop("organization_id", None)
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        user._initial_org_id = org_id
        return user


class MeSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source="role.name", read_only=True)
    linked_client_name = serializers.CharField(source="linked_client.client_name", read_only=True)
    linked_client_company_name = serializers.CharField(source="linked_client.company.company_name", read_only=True, default=None)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email", "phone",
            "user_type", "linked_client", "linked_client_name", "linked_client_company_name", "is_portal_client",
            "role", "role_name", "is_superuser", "permissions",
        ]

    def get_permissions(self, user):
        from .permissions import get_effective_permissions_dict
        return get_effective_permissions_dict(user)
