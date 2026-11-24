from django.db import migrations

from apps.core.modules import (
    CATALOG,
    CLIENTS,
    COMPANIES,
    COSTING,
    MODULES,
    NOTIFICATIONS,
    ORDERS,
    QUOTATIONS,
    REPORTS,
    SETTINGS,
    SUPPLIERS,
    USERS,
)


def seed_client_role(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    RolePermission = apps.get_model("accounts", "RolePermission")

    # 1. Ensure Admin role has full flags
    admin_role = Role.objects.filter(name="Admin").first()
    if admin_role:
        for module in MODULES:
            RolePermission.objects.update_or_create(
                role=admin_role,
                module=module,
                defaults={
                    "can_view": True,
                    "can_add": True,
                    "can_edit": True,
                    "can_delete": True,
                    "can_submit": True,
                    "can_cancel": True,
                    "can_print": True,
                    "can_export": True,
                    "apply_user_permissions": False,
                    "only_if_creator": False,
                    "permlevel": 0,
                },
            )

    # 2. Ensure Staff role has print & export
    staff_role = Role.objects.filter(name="Staff").first()
    if staff_role:
        RolePermission.objects.filter(role=staff_role).update(can_print=True, can_export=True, can_submit=True)

    # 3. Create or update Client role (is_system=True)
    client_role, _ = Role.objects.get_or_create(
        name="Client",
        defaults={
            "description": "External client/customer portal access with row-level restrictions and hidden internal margins.",
            "is_system": True,
        },
    )

    client_matrix = {
        QUOTATIONS: {"can_view": True, "can_submit": True, "can_print": True, "apply_user_permissions": True},
        ORDERS: {"can_view": True, "can_print": True, "apply_user_permissions": True},
        CATALOG: {"can_view": True},
        CLIENTS: {"can_view": True, "apply_user_permissions": True},
        COMPANIES: {"can_view": True, "apply_user_permissions": True},
        NOTIFICATIONS: {"can_view": True, "apply_user_permissions": True},
    }

    for module in MODULES:
        perms = client_matrix.get(module, {})
        RolePermission.objects.update_or_create(
            role=client_role,
            module=module,
            defaults={
                "can_view": perms.get("can_view", False),
                "can_add": perms.get("can_add", False),
                "can_edit": perms.get("can_edit", False),
                "can_delete": perms.get("can_delete", False),
                "can_submit": perms.get("can_submit", False),
                "can_cancel": perms.get("can_cancel", False),
                "can_print": perms.get("can_print", False),
                "can_export": perms.get("can_export", False),
                "apply_user_permissions": perms.get("apply_user_permissions", False),
                "only_if_creator": False,
                "permlevel": 0,
            },
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_rolepermission_apply_user_permissions_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_client_role, noop),
    ]

