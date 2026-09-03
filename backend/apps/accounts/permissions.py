"""RBAC helpers: the module x action check, and the DRF permission class that
uses it. Every viewset in the project sets `module_name = modules.XYZ` and gets
enforcement for free via ModulePermission below."""

from rest_framework.permissions import BasePermission

from apps.core.modules import METHOD_ACTION_MAP, MODULES

from .models import Role, RolePermission


def has_permission(user, module: str, action: str) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    if not user.role_id:
        return False
    try:
        perm = RolePermission.objects.get(role_id=user.role_id, module=module)
    except RolePermission.DoesNotExist:
        return False
    return perm.allows(action)


def sync_role_permissions():
    """Backfill missing (role, module) rows as all-False, so a newly added
    module shows up (denied by default) for every existing role instead of
    raising DoesNotExist. Safe to call repeatedly (e.g. from a data migration
    or on app startup)."""
    for role in Role.objects.all():
        existing = set(RolePermission.objects.filter(role=role).values_list("module", flat=True))
        missing = set(MODULES) - existing
        RolePermission.objects.bulk_create(
            [RolePermission(role=role, module=module) for module in missing]
        )


class ModulePermission(BasePermission):
    """DRF permission class: reads `view.module_name` and maps the HTTP method
    to view/add/edit/delete via METHOD_ACTION_MAP."""

    def has_permission(self, request, view):
        module = getattr(view, "module_name", None)
        if module is None:
            return False
        action = METHOD_ACTION_MAP.get(request.method)
        if action is None:
            return False
        return has_permission(request.user, module, action)
