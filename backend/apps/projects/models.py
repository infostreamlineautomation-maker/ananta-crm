from django.db import models

from apps.core.models import AuditedModel, SoftDeleteModel


class Project(AuditedModel, SoftDeleteModel):
    """Groups one client's related orders, quotations, and costing sheets
    under a single engagement — e.g. "Diwali Catalog 2026" might have two
    quotation revisions, three print-run orders, and a costing sheet, all
    tied together here. Added at the client's request after the legacy app's
    flat Orders list; Order/Quotation/Costing.project is nullable so
    standalone one-off jobs still don't need a project created first."""

    ACTIVE, ON_HOLD, COMPLETED, CANCELLED = "active", "on_hold", "completed", "cancelled"
    STATUS_CHOICES = [
        (ACTIVE, "Active"),
        (ON_HOLD, "On Hold"),
        (COMPLETED, "Completed"),
        (CANCELLED, "Cancelled"),
    ]

    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="projects")
    name = models.CharField(max_length=200)
    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="projects")
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=ACTIVE)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.client.client_name})"
