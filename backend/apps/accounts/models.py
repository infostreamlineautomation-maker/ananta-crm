from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.core.modules import ACTIONS, MODULE_CHOICES


class Role(models.Model):
    """A named role (Admin, Staff, or any future role like Accounts/Sales) that
    RolePermission rows are attached to. is_system protects the two roles the
    app ships with from being deleted from the UI."""

    name = models.CharField(max_length=50, unique=True)
    description = models.CharField(max_length=200, blank=True)
    is_system = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class RolePermission(models.Model):
    """One row per (role, module): the module x action matrix. A missing row
    for a role/module pair means no access — sync_role_permissions() backfills
    zeroed-out rows whenever a new module is registered."""

    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="permissions")
    module = models.CharField(max_length=32, choices=MODULE_CHOICES)
    can_view = models.BooleanField(default=False)
    can_add = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)
    can_submit = models.BooleanField(default=False, help_text="Frappe docstatus submit permission (e.g. approve quotation, confirm order)")
    can_cancel = models.BooleanField(default=False, help_text="Frappe docstatus cancel permission")
    can_print = models.BooleanField(default=False, help_text="Print and export official PDF")
    can_export = models.BooleanField(default=False, help_text="Export data to CSV/Excel")
    apply_user_permissions = models.BooleanField(
        default=False,
        help_text="Frappe style: Restrict row visibility to user's linked Client or Company.",
    )
    only_if_creator = models.BooleanField(default=False, help_text="Restrict access to documents created by the user.")
    permlevel = models.PositiveSmallIntegerField(
        default=0,
        help_text="0: Standard public/client level; 1: Internal financial & supplier data.",
    )

    class Meta:
        unique_together = ("role", "module")
        ordering = ["role_id", "module"]

    def __str__(self):
        return f"{self.role.name} / {self.module}"

    def allows(self, action: str) -> bool:
        assert action in ACTIONS
        return getattr(self, f"can_{action}", False)


class UserType(models.TextChoices):
    SYSTEM_USER = "system_user", "System User"
    PORTAL_USER = "portal_user", "Portal / Client User"


class User(AbstractUser):
    """Custom user so we can attach a Role. Django's is_superuser stays as the
    hard bypass (matches Django admin conventions); everyone else is gated by
    their Role's RolePermission rows."""

    user_type = models.CharField(
        max_length=20,
        choices=UserType.choices,
        default=UserType.SYSTEM_USER,
    )
    role = models.ForeignKey(Role, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")
    phone = models.CharField(max_length=20, blank=True)
    linked_client = models.ForeignKey(
        "clients.Client",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="portal_users",
        help_text="If set, this user's queries are strictly filtered to this Client record.",
    )

    def __str__(self):
        return self.get_full_name() or self.username

    @property
    def is_portal_client(self) -> bool:
        if self.is_superuser:
            return False
        return (
            self.user_type == UserType.PORTAL_USER
            or (self.role and self.role.name.lower() in ("client", "customer"))
        )
