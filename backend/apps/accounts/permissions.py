"""RBAC helpers: the module x action check, and the DRF permission class that
uses it. Every viewset in the project sets `module_name = modules.XYZ` and gets
enforcement for free via ModulePermission below."""

from rest_framework.permissions import BasePermission

from apps.core.modules import (
    ACTIONS,
    CATALOG,
    CLIENTS,
    COMPANIES,
    METHOD_ACTION_MAP,
    MODULES,
    NOTIFICATIONS,
    ORDERS,
    QUOTATIONS,
)

from .models import Role, RolePermission

PORTAL_CLIENT_DEFAULT_MATRIX = {
    QUOTATIONS: {"view": True, "submit": True, "print": True, "apply_user_permissions": True},
    ORDERS: {"view": True, "print": True, "apply_user_permissions": True},
    CATALOG: {"view": True},
    CLIENTS: {"view": True, "apply_user_permissions": True},
    COMPANIES: {"view": True, "print": True, "apply_user_permissions": True},
    NOTIFICATIONS: {"view": True, "print": True, "apply_user_permissions": True},
}


def get_effective_permissions_dict(user) -> dict:
    if not user or not getattr(user, "is_authenticated", False):
        return {}
    if user.is_superuser:
        return {module: {action: True for action in ACTIONS} for module in MODULES}

    perms_map = {}
    if user.role_id:
        perms_map = {
            rp.module: {
                "view": rp.can_view,
                "add": rp.can_add,
                "edit": rp.can_edit,
                "delete": rp.can_delete,
                "submit": rp.can_submit,
                "cancel": rp.can_cancel,
                "print": rp.can_print,
                "export": rp.can_export,
                "apply_user_permissions": rp.apply_user_permissions,
                "permlevel": rp.permlevel,
            }
            for rp in user.role.permissions.all()
        }

    # If a portal client user has no role or their role has zero view permissions
    # configured yet, apply the standard Client Portal matrix so their linked
    # orders, quotations, and tracking views remain accessible.
    if getattr(user, "is_portal_client", False) and not any(v.get("view") for v in perms_map.values()):
        return {
            module: {
                "view": PORTAL_CLIENT_DEFAULT_MATRIX.get(module, {}).get("view", False),
                "add": False,
                "edit": False,
                "delete": False,
                "submit": PORTAL_CLIENT_DEFAULT_MATRIX.get(module, {}).get("submit", False),
                "cancel": False,
                "print": PORTAL_CLIENT_DEFAULT_MATRIX.get(module, {}).get("print", False),
                "export": False,
                "apply_user_permissions": PORTAL_CLIENT_DEFAULT_MATRIX.get(module, {}).get("apply_user_permissions", False),
                "permlevel": 0,
            }
            for module in MODULES
        }

    return perms_map


def seed_client_role_permissions(role: Role):
    for module in MODULES:
        cfg = PORTAL_CLIENT_DEFAULT_MATRIX.get(module, {})
        RolePermission.objects.update_or_create(
            role=role,
            module=module,
            defaults={
                "can_view": cfg.get("view", False),
                "can_add": False,
                "can_edit": False,
                "can_delete": False,
                "can_submit": cfg.get("submit", False),
                "can_cancel": False,
                "can_print": cfg.get("print", False),
                "can_export": False,
                "apply_user_permissions": cfg.get("apply_user_permissions", False),
                "only_if_creator": False,
                "permlevel": 0,
            },
        )


def has_permission(user, module: str, action: str) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_superuser:
        return True
    if not user.role_id:
        if getattr(user, "is_portal_client", False):
            return bool(PORTAL_CLIENT_DEFAULT_MATRIX.get(module, {}).get(action, False))
        return False
    try:
        perm = RolePermission.objects.get(role_id=user.role_id, module=module)
        allowed = perm.allows(action)
    except RolePermission.DoesNotExist:
        allowed = False

    if not allowed and getattr(user, "is_portal_client", False):
        if not RolePermission.objects.filter(role_id=user.role_id, can_view=True).exists():
            return bool(PORTAL_CLIENT_DEFAULT_MATRIX.get(module, {}).get(action, False))
    return allowed


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
