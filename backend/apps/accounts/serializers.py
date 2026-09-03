from rest_framework import serializers

from .models import Role, RolePermission, User


class RolePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RolePermission
        fields = ["id", "module", "can_view", "can_add", "can_edit", "can_delete"]


class RoleSerializer(serializers.ModelSerializer):
    permissions = RolePermissionSerializer(many=True, read_only=True)

    class Meta:
        model = Role
        fields = ["id", "name", "description", "is_system", "permissions"]


class UserSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email", "phone",
            "role", "role_name", "is_active", "is_superuser", "date_joined",
        ]
        read_only_fields = ["date_joined"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "phone", "role", "password"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class MeSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source="role.name", read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "role", "role_name", "is_superuser", "permissions"]

    def get_permissions(self, user):
        if user.is_superuser:
            from apps.core.modules import ACTIONS, MODULES

            return {module: {action: True for action in ACTIONS} for module in MODULES}
        if not user.role_id:
            return {}
        return {
            rp.module: {"view": rp.can_view, "add": rp.can_add, "edit": rp.can_edit, "delete": rp.can_delete}
            for rp in user.role.permissions.all()
        }
