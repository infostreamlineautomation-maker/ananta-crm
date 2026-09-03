from django.db import models

from apps.core.models import AuditedModel, SoftDeleteModel


class Product(AuditedModel, SoftDeleteModel):
    """Flat catalog, matching the legacy app. SKU/category can be added later
    without disrupting Orders/Quotations, which reference Product by FK."""

    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="products")
    product_name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["product_name"]

    def __str__(self):
        return self.product_name
