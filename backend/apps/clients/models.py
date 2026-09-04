from django.db import models

from apps.core.models import AuditedModel, SoftDeleteModel


class Company(AuditedModel, SoftDeleteModel):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="companies")
    company_name = models.CharField(max_length=200)
    contact_name = models.CharField(max_length=150, blank=True)
    vat_id = models.CharField(max_length=50, blank=True)
    reg_no = models.CharField(max_length=50, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=30, blank=True)
    company_phone = models.CharField(max_length=30, blank=True)
    country = models.ForeignKey("core.Country", null=True, blank=True, on_delete=models.PROTECT, related_name="companies")
    state = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    zip_code = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    facebook = models.URLField(blank=True)
    twitter = models.URLField(blank=True)
    linkedin = models.URLField(blank=True)
    remarks = models.TextField(blank=True)
    logo = models.ImageField(upload_to="companies/logos/", null=True, blank=True)
    extra_data = models.JSONField(default=dict, blank=True, help_text="Custom field attributes for company")

    class Meta:
        ordering = ["company_name"]
        verbose_name_plural = "companies"

    def __str__(self):
        return self.company_name


class Client(AuditedModel, SoftDeleteModel):
    TYPE_A, TYPE_B, TYPE_C = "A", "B", "C"
    CLIENT_TYPE_CHOICES = [(TYPE_A, "A"), (TYPE_B, "B"), (TYPE_C, "C")]

    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="clients")
    client_name = models.CharField(max_length=200)
    client_type = models.CharField(max_length=1, choices=CLIENT_TYPE_CHOICES, default=TYPE_B)
    company = models.ForeignKey(Company, null=True, blank=True, on_delete=models.SET_NULL, related_name="clients")
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    country = models.ForeignKey(
        "core.Country",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="clients",
        help_text="Drives the default currency on this client's quotations.",
    )
    extra_data = models.JSONField(default=dict, blank=True, help_text="Custom field attributes for client")

    class Meta:
        ordering = ["client_name"]

    def __str__(self):
        return self.client_name

    @property
    def effective_country(self):
        """Falls back to the parent company's country if the client itself
        doesn't have one set."""
        return self.country or (self.company.country if self.company_id else None)

