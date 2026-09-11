from django.db import models

from apps.core.models import AuditedModel, SoftDeleteModel


class Supplier(AuditedModel, SoftDeleteModel):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="suppliers")
    supplier_name = models.CharField(max_length=200)
    company_name = models.CharField(max_length=200, blank=True)
    owner_name_contact = models.CharField(max_length=150, blank=True)
    contact = models.CharField(max_length=30, blank=True)
    source = models.CharField(max_length=150, blank=True)
    product_details = models.TextField(blank=True, help_text="Product details and categories supplied")
    address = models.TextField(blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    remark = models.TextField(blank=True)
    extra_data = models.JSONField(default=dict, blank=True, help_text="Custom field attributes for supplier")

    class Meta:
        ordering = ["supplier_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "supplier_name"],
                condition=models.Q(is_deleted=False),
                name="unique_active_supplier_name_per_org",
            )
        ]

    def __str__(self):
        return self.supplier_name



class SupplierContact(models.Model):
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name="contacts")
    contact_name = models.CharField(max_length=150)
    contact_number = models.CharField(max_length=30, blank=True)
    designation = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.contact_name} ({self.supplier.supplier_name})"


class SupplierProduct(models.Model):
    """Links a supplier to what they actually supply from the real catalog —
    the legacy app stored this as a free-text product name with no FK."""

    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name="supplier_products")
    product = models.ForeignKey("catalog.Product", on_delete=models.CASCADE, related_name="supplier_products")

    class Meta:
        unique_together = ("supplier", "product")


class SupplierFile(models.Model):
    QUOTATION, RATE_CARD, BROCHURE = "quotation", "rate_card", "brochure"
    FILE_TYPE_CHOICES = [
        (QUOTATION, "Quotation"),
        (RATE_CARD, "Rate Card"),
        (BROCHURE, "Brochure"),
    ]

    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name="files")
    file_type = models.CharField(max_length=20, choices=FILE_TYPE_CHOICES)
    file = models.FileField(upload_to="suppliers/files/")
    file_size = models.PositiveIntegerField()
    mime_type = models.CharField(max_length=100)
    uploaded_by = models.ForeignKey(
        "accounts.User", null=True, on_delete=models.SET_NULL, related_name="uploaded_supplier_files"
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]
