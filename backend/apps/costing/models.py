from django.db import models

from apps.core.models import AuditedModel, SoftDeleteModel


class Costing(AuditedModel, SoftDeleteModel):
    """Supplier-cost vs client-rate margin calculator. Fixed from the legacy
    version to hold real FKs instead of free-text names matched at save time —
    the API layer still supports picking-or-creating a supplier/product/client
    inline (the "fast-track" UX pattern the legacy app used), it just resolves
    to a real row before saving here instead of after."""

    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="costings")
    costing_date = models.DateField()
    project = models.ForeignKey(
        "projects.Project", null=True, blank=True, on_delete=models.SET_NULL, related_name="costings"
    )
    supplier = models.ForeignKey("suppliers.Supplier", on_delete=models.PROTECT, related_name="costings")
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, related_name="costings")
    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="costings")
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["-costing_date", "-id"]
        verbose_name_plural = "costings"

    def __str__(self):
        return f"Costing #{self.pk} — {self.client.client_name}"

    @property
    def supplier_cost(self):
        return sum((item.supplier_rate * item.quantity for item in self.items.all()), 0)

    @property
    def client_revenue(self):
        return sum((item.client_rate * item.quantity for item in self.items.all()), 0)

    @property
    def profit(self):
        return self.client_revenue - self.supplier_cost

    @property
    def profit_percent(self):
        cost = self.supplier_cost
        return (self.profit / cost * 100) if cost else 0


class CostingItem(models.Model):
    costing = models.ForeignKey(Costing, on_delete=models.CASCADE, related_name="items")
    supplier_rate = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    client_rate = models.DecimalField(max_digits=12, decimal_places=2)

    @property
    def profit(self):
        return (self.client_rate - self.supplier_rate) * self.quantity
