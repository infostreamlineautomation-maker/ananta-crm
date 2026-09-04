from django.conf import settings
from django.db import models


class TimestampedModel(models.Model):
    """created_at/updated_at for every business record."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class AuditedModel(TimestampedModel):
    """Adds who-created/who-last-edited, matching the activity-log pattern the
    legacy suppliers module already had — extended here to every module."""

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="%(app_label)s_%(class)s_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="%(app_label)s_%(class)s_updated",
    )

    class Meta:
        abstract = True


class SoftDeleteModel(models.Model):
    """is_deleted flag instead of a hard DELETE, applied consistently across
    every module (the legacy app only had this for suppliers/quotations/costings)."""

    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True


class Country(models.Model):
    """Country -> default currency lookup, used to derive a quotation's currency
    from the client's country. Seeded with common trading partners; more can be
    added from the Django admin without a code change."""

    code = models.CharField(max_length=2, primary_key=True, help_text="ISO 3166-1 alpha-2, e.g. IN")
    name = models.CharField(max_length=80, unique=True)
    currency_code = models.CharField(max_length=3, help_text="ISO 4217, e.g. INR")
    currency_symbol = models.CharField(max_length=6, help_text="e.g. ₹")

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "countries"

    def __str__(self):
        return f"{self.name} ({self.currency_code})"


class NumberSequence(models.Model):
    """Backs next_number() in numbering.py — a real locked counter row per
    (organization, prefix+year) key, instead of scanning MAX(existing number)
    and hoping two concurrent requests don't land on the same value.
    Scoped per organization so Ananta and Meewa each get their own
    ORD-2026-0001, rather than sharing one counter across both businesses."""

    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="number_sequences")
    key = models.CharField(max_length=40)
    last_value = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("organization", "key")


class ExchangeRate(models.Model):
    """Stores exchange rates against target base currency. Scoped per organization.
    Supports live syncing via free Open Exchange Rates / ECB feed and manual override."""

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="exchange_rates",
        null=True,
        blank=True,
    )
    source_currency = models.CharField(max_length=3, help_text="e.g. AED, USD, EUR, GBP, INR")
    target_currency = models.CharField(max_length=3, help_text="e.g. INR or AED (base currency)")
    rate = models.DecimalField(max_digits=14, decimal_places=6, default=1.0)
    market_rate = models.DecimalField(max_digits=14, decimal_places=6, default=1.0)
    is_manual_override = models.BooleanField(default=False)
    last_synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("organization", "source_currency", "target_currency")
        ordering = ["source_currency"]

    def __str__(self):
        return f"1 {self.source_currency} = {self.rate} {self.target_currency}"


class ActivityLog(models.Model):
    """Generic audit trail, generalizing the legacy suppliers-only activity log
    to every module. One row per create/update/delete/upload action."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="activity_logs"
    )
    module = models.CharField(max_length=32)
    object_id = models.CharField(max_length=64)
    action = models.CharField(max_length=32)
    details = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["module", "object_id"])]

    def __str__(self):
        return f"{self.module}#{self.object_id} {self.action} by {self.user_id}"


class CustomFieldDefinition(AuditedModel):
    """Dynamic custom column/field definition configurable per organization.
    Controls what dynamic attributes and columns appear on data entry tables,
    detail cards, invoices, and CSV exports."""

    MODULE_ORDER_ITEM = "order_item"
    MODULE_QUOTATION_ITEM = "quotation_item"
    MODULE_COSTING_ITEM = "costing_item"
    MODULE_PRODUCT = "product"
    MODULE_CLIENT = "client"
    MODULE_COMPANY = "company"
    MODULE_SUPPLIER = "supplier"
    MODULE_PROJECT = "project"

    MODULE_CHOICES = [
        (MODULE_ORDER_ITEM, "Order Line Item"),
        (MODULE_QUOTATION_ITEM, "Quotation Line Item"),
        (MODULE_COSTING_ITEM, "Costing Line Item"),
        (MODULE_PRODUCT, "Product / Catalog"),
        (MODULE_CLIENT, "Client"),
        (MODULE_COMPANY, "Company"),
        (MODULE_SUPPLIER, "Supplier"),
        (MODULE_PROJECT, "Project"),
    ]

    TYPE_TEXT = "text"
    TYPE_NUMBER = "number"
    TYPE_SELECT = "select"
    TYPE_DATE = "date"
    TYPE_BOOLEAN = "boolean"

    TYPE_CHOICES = [
        (TYPE_TEXT, "Text"),
        (TYPE_NUMBER, "Number"),
        (TYPE_SELECT, "Dropdown Selection"),
        (TYPE_DATE, "Date"),
        (TYPE_BOOLEAN, "Yes / No (Checkbox)"),
    ]

    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE, related_name="custom_field_definitions"
    )
    module = models.CharField(max_length=32, choices=MODULE_CHOICES)
    field_key = models.CharField(
        max_length=64,
        help_text="Key stored in JSON extra_data, e.g. 'paper_gsm' or 'hsn_code'",
    )
    label = models.CharField(max_length=128, help_text="Display label shown in forms and table headers")
    field_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_TEXT)
    options = models.JSONField(
        default=list, blank=True, help_text="List of choices if field_type is 'select'"
    )
    default_value = models.CharField(max_length=255, blank=True)
    is_required = models.BooleanField(default=False)
    show_in_table = models.BooleanField(default=True, help_text="Show as a column in list tables")
    show_in_print = models.BooleanField(default=True, help_text="Include in print / PDF invoice templates")
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        unique_together = ("organization", "module", "field_key")

    def __str__(self):
        return f"{self.get_module_display()}: {self.label} ({self.field_key})"

