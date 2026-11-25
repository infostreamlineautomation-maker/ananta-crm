from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from apps.core.modules import EDIT, MODULES, USERS

from .models import Role, RolePermission, User
from .permissions import ModulePermission, has_permission, sync_role_permissions
from .serializers import MeSerializer, RolePermissionSerializer, RoleSerializer, UserCreateSerializer, UserSerializer


class LoginRateThrottle(AnonRateThrottle):
    """Keyed by IP (see DEFAULT_THROTTLE_RATES["login"] in settings) — the
    legacy app had no brute-force protection on login at all."""

    scope = "login"


@api_view(["GET"])
@permission_classes([AllowAny])
def csrf(request):
    """Front end calls this once to receive a csrftoken cookie before POSTing
    to /login/ — session auth + CsrfViewMiddleware requires it, unlike the
    legacy app which had no CSRF protection at all."""
    return Response({"csrfToken": get_token(request)})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login_view(request):
    username = request.data.get("username", "")
    password = request.data.get("password", "")
    user = authenticate(request, username=username, password=password)
    if user is None or not user.is_active:
        return Response({"detail": "Invalid username or password."}, status=status.HTTP_400_BAD_REQUEST)
    login(request, user)
    return Response(MeSerializer(user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(MeSerializer(request.user).data)


class RoleViewSet(viewsets.ModelViewSet):
    """Roles + their module x action matrix. Gated behind the Users module
    permission — managing who can do what is itself a permission-checked action."""

    queryset = Role.objects.prefetch_related("permissions").all()
    serializer_class = RoleSerializer
    permission_classes = [ModulePermission]
    module_name = USERS

    def perform_create(self, serializer):
        role = serializer.save()
        sync_role_permissions()
        return role

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system:
            return Response({"detail": "Admin and Staff are built-in roles and can't be deleted."}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["put"])
    def permissions(self, request, pk=None):
        """Bulk-set the module x action matrix for this role:
        [{"module": "orders", "can_view": true, "can_add": true, ...}, ...]"""
        role = self.get_object()
        rows = request.data if isinstance(request.data, list) else []
        valid_modules = set(MODULES)
        for row in rows:
            module = row.get("module")
            if module not in valid_modules:
                return Response({"detail": f"Unknown module: {module}"}, status=status.HTTP_400_BAD_REQUEST)
            RolePermission.objects.update_or_create(
                role=role,
                module=module,
                defaults={
                    "can_view": bool(row.get("can_view")),
                    "can_add": bool(row.get("can_add")),
                    "can_edit": bool(row.get("can_edit")),
                    "can_delete": bool(row.get("can_delete")),
                    "can_submit": bool(row.get("can_submit")),
                    "can_cancel": bool(row.get("can_cancel")),
                    "can_print": bool(row.get("can_print")),
                    "can_export": bool(row.get("can_export")),
                    "apply_user_permissions": bool(row.get("apply_user_permissions")),
                    "only_if_creator": bool(row.get("only_if_creator")),
                    "permlevel": int(row.get("permlevel", 0) or 0),
                },
            )
        serializer = RolePermissionSerializer(role.permissions.all(), many=True)
        return Response(serializer.data)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("role", "linked_client", "linked_client__company").all()
    permission_classes = [ModulePermission]
    module_name = USERS

    def get_queryset(self):
        qs = super().get_queryset()
        role_id = self.request.query_params.get("role")
        if role_id:
            qs = qs.filter(role_id=role_id)
        user_type = self.request.query_params.get("user_type")
        if user_type:
            qs = qs.filter(user_type=user_type)
        client_id = self.request.query_params.get("client")
        if client_id:
            qs = qs.filter(linked_client_id=client_id)
        return qs

    def get_serializer_class(self):
        return UserCreateSerializer if self.request.method == "POST" else UserSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        from apps.organizations.models import Organization, OrganizationMembership

        org_id = (
            getattr(user, "_initial_org_id", None)
            or self.request.data.get("organization")
            or self.request.data.get("organization_id")
        )
        if not org_id and getattr(user, "linked_client", None):
            org_id = user.linked_client.organization_id

        is_portal = getattr(user, "is_portal_client", False) or getattr(user, "user_type", "") == "portal_user"

        if is_portal or org_id:
            chosen_org = None
            if org_id:
                chosen_org = Organization.objects.filter(id=org_id).first()
            if not chosen_org and getattr(user, "linked_client", None):
                chosen_org = user.linked_client.organization

            if chosen_org:
                OrganizationMembership.objects.get_or_create(user=user, organization=chosen_org)
                if is_portal:
                    # External client users are strictly scoped to only one organization
                    OrganizationMembership.objects.filter(user=user).exclude(organization=chosen_org).delete()
            return user

        active_org = getattr(self.request, "organization", None)
        if active_org:
            OrganizationMembership.objects.get_or_create(user=user, organization=active_org)
        for org in Organization.objects.all():
            OrganizationMembership.objects.get_or_create(user=user, organization=org)
        return user

    def perform_update(self, serializer):
        user = serializer.save()
        from apps.organizations.models import Organization, OrganizationMembership

        org_id = self.request.data.get("organization") or self.request.data.get("organization_id")
        is_portal = getattr(user, "is_portal_client", False) or getattr(user, "user_type", "") == "portal_user"

        if not org_id and getattr(user, "linked_client", None) and is_portal:
            org_id = user.linked_client.organization_id

        if org_id:
            chosen_org = Organization.objects.filter(id=org_id).first()
            if chosen_org:
                OrganizationMembership.objects.get_or_create(user=user, organization=chosen_org)
                if is_portal:
                    OrganizationMembership.objects.filter(user=user).exclude(organization=chosen_org).delete()
        return user

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.id == request.user.id:
            return Response({"detail": "You cannot delete your own account."}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def set_password(self, request, pk=None):
        """UserSerializer deliberately has no password field (it's used for
        GET/PATCH and shouldn't round-trip a hash), and UserCreateSerializer
        only runs on POST — so there was no way to reset an existing user's
        password until this action existed."""
        if not has_permission(request.user, USERS, EDIT):
            return Response({"detail": "You do not have permission to perform this action."}, status=status.HTTP_403_FORBIDDEN)
        user = self.get_object()
        password = request.data.get("password", "")
        if len(password) < 8:
            return Response({"detail": "Password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(password)
        user.save(update_fields=["password"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reset_password(self, request, pk=None):
        """Alias for set_password."""
        return self.set_password(request, pk)
