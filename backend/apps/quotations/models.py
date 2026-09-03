from django.db import models

from apps.core.models import AuditedModel, SoftDeleteModel


class Quotation(AuditedModel, SoftDeleteModel):
    """Independent from Order by design (see the audit's decisions section) —
    an accepted quotation is turned into an order via a one-off "create order
    from this quotation" action in the API, not a stored link."""

    DRAFT, SENT, ACCEPTED, REJECTED = "draft", "sent", "accepted", "rejected"
    STATUS_CHOICES = [
        (DRAFT, "Draft"),
        (SENT, "Sent"),
        (ACCEPTED, "Accepted"),
        (REJECTED, "Rejected"),
    ]

    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="quotations")
    quotation_no = models.CharField(max_length=30, editable=False)
    quotation_date = models.DateField()
    client = models.ForeignKey(
        "clients.Client", null=True, blank=True, on_delete=models.SET_NULL, related_name="quotations"
    )
    project = models.ForeignKey(
        "projects.Project", null=True, blank=True, on_delete=models.SET_NULL, related_name="quotations"
    )
    to_name = models.CharField(max_length=200, blank=True)
    to_address = models.TextField(blank=True)
    subject = models.CharField(max_length=250, blank=True)
    intro_text = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    footer_content = models.TextField(blank=True)

    col_qty_label = models.CharField(max_length=50, default="Qty")
    col_rate_label = models.CharField(max_length=50, default="Rate")
    columns_config = models.JSONField(
        default=list,
        blank=True,
        help_text="Extra custom columns beyond description/qty/rate, e.g. "
        '[{"key": "custom_size", "label": "Size"}]. Values live per-item in '
        "QuotationItem.extra_data under the same key.",
    )

    currency_code = models.CharField(
        max_length=3,
        default="INR",
        help_text="Defaults from the client's country at creation time, editable per-quotation.",
    )
    exchange_rate = models.DecimalField(
        max_digits=14,
        decimal_places=6,
        default=1.0,
        help_text="Conversion rate of 1 currency_code into organization base_currency_code",
    )
    base_currency_code = models.CharField(max_length=3, default="INR", help_text="Organization base currency at quotation creation")

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=DRAFT)

    class Meta:
        ordering = ["-quotation_date", "-id"]
        unique_together = ("organization", "quotation_no")

    def __str__(self):
        return self.quotation_no

    @property
    def subtotal(self):
        return sum((item.qty * item.rate for item in self.items.all()), 0)


class QuotationItem(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name="items")
    description = models.TextField(blank=True)
    qty = models.DecimalField(max_digits=10, decimal_places=2)
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    image = models.ImageField(
        upload_to="quotations/items/",
        null=True,
        blank=True,
        help_text="A real column — the legacy app buried this inside the extra_data JSON blob.",
    )
    extra_data = models.JSONField(default=dict, blank=True, help_text="Values for Quotation.columns_config keys.")
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    @property
    def amount(self):
        return self.qty * self.rate
