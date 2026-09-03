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

    class Meta:
        unique_together = ("role", "module")
        ordering = ["role_id", "module"]

    def __str__(self):
        return f"{self.role.name} / {self.module}"

    def allows(self, action: str) -> bool:
        assert action in ACTIONS
        return getattr(self, f"can_{action}")


class User(AbstractUser):
    """Custom user so we can attach a Role. Django's is_superuser stays as the
    hard bypass (matches Django admin conventions); everyone else is gated by
    their Role's RolePermission rows."""

    role = models.ForeignKey(Role, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")
    phone = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return self.get_full_name() or self.username
