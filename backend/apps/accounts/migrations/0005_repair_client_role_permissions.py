from django.db import migrations

from apps.core.modules import (
    CATALOG,
    CLIENTS,
    COMPANIES,
    MODULES,
    NOTIFICATIONS,
    ORDERS,
    QUOTATIONS,
)


def repair_client_role_and_memberships(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    RolePermission = apps.get_model("accounts", "RolePermission")
    User = apps.get_model("accounts", "User")
    OrganizationMembership = apps.get_model("organizations", "OrganizationMembership")

    client_matrix = {
        QUOTATIONS: {"can_view": True, "can_submit": True, "can_print": True, "apply_user_permissions": True},
        ORDERS: {"can_view": True, "can_print": True, "apply_user_permissions": True},
        CATALOG: {"can_view": True},
        CLIENTS: {"can_view": True, "apply_user_permissions": True},
        COMPANIES: {"can_view": True, "can_print": True, "apply_user_permissions": True},
        NOTIFICATIONS: {"can_view": True, "can_print": True, "apply_user_permissions": True},
    }

    # Ensure Client role exists and has portal permissions enabled if currently missing/blank
    client_roles = Role.objects.filter(name__iexact="Client")
    if not client_roles.exists():
        client_role = Role.objects.create(
            name="Client",
            description="External client/customer portal access with row-level restrictions and hidden internal margins.",
            is_system=True,
        )
        client_roles = [client_role]

    for role in client_roles:
        has_any_view = RolePermission.objects.filter(role=role, can_view=True).exists()
        if not has_any_view:
            for module in MODULES:
                perms = client_matrix.get(module, {})
                RolePermission.objects.update_or_create(
                    role=role,
                    module=module,
                    defaults={
                        "can_view": perms.get("can_view", False),
                        "can_add": False,
                        "can_edit": False,
                        "can_delete": False,
                        "can_submit": perms.get("can_submit", False),
                        "can_cancel": False,
                        "can_print": perms.get("can_print", False),
                        "can_export": False,
                        "apply_user_permissions": perms.get("apply_user_permissions", False),
                        "only_if_creator": False,
                        "permlevel": 0,
                    },
                )

    # Align OrganizationMembership for every portal user with their linked client's organization
    for u in User.objects.select_related("linked_client").filter(linked_client__isnull=False):
        if u.user_type == "portal_user" or (u.role and u.role.name.lower() in ("client", "customer")):
            org_id = u.linked_client.organization_id
            if org_id:
                OrganizationMembership.objects.get_or_create(user=u, organization_id=org_id)
                OrganizationMembership.objects.filter(user=u).exclude(organization_id=org_id).delete()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0004_seed_client_role"),
        ("organizations", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(repair_client_role_and_memberships, noop),
    ]
