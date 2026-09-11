from decimal import Decimal

from django.db import models

from apps.core.models import AuditedModel


class Order(AuditedModel):
    """Header for a multi-line order. Unlike the legacy app (one order = one
    line item), this normalizes to OrderItem so Orders and Quotations share
    the same shape. Totals are always recalculated server-side in
    recalc_totals() — never trusted from the client, closing the flaw where
    the legacy app inserted a browser-computed grand_total verbatim."""

    PENDING, IN_PROCESS, READY, DELIVERED = "pending", "in_process", "ready", "delivered"
    DELIVERY_STATUS_CHOICES = [
        (PENDING, "Pending"),
        (IN_PROCESS, "In Process"),
        (READY, "Ready"),
        (DELIVERED, "Delivered"),
    ]

    PAYMENT_PENDING, PAYMENT_ADVANCE, PAYMENT_PARTIAL, PAYMENT_PAID = "pending", "advance", "partial", "paid"
    PAYMENT_STATUS_CHOICES = [
        (PAYMENT_PENDING, "Pending"),
        (PAYMENT_ADVANCE, "Advance"),
        (PAYMENT_PARTIAL, "Partial"),
        (PAYMENT_PAID, "Paid"),
    ]

    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="orders")
    order_no = models.CharField(max_length=30, editable=False)
    date = models.DateField()
    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="orders")
    project_title = models.CharField(max_length=200, blank=True, help_text="e.g. Diamond Standy")
    project = models.ForeignKey(
        "projects.Project", null=True, blank=True, on_delete=models.SET_NULL, related_name="orders"
    )
    supplier = models.ForeignKey(
        "suppliers.Supplier", null=True, blank=True, on_delete=models.SET_NULL, related_name="orders"
    )
    delivery_time = models.CharField(max_length=200, blank=True, help_text="e.g. Aje Joie chhe print thai ne")
    description = models.TextField(blank=True)

    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), editable=False)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), editable=False)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), editable=False)

    currency_code = models.CharField(max_length=3, default="INR", help_text="Billing currency of this order")
    exchange_rate = models.DecimalField(
        max_digits=14,
        decimal_places=6,
        default=Decimal("1.0"),
        help_text="Conversion rate of 1 currency_code into organization base_currency_code",
    )
    base_currency_code = models.CharField(max_length=3, default="INR", help_text="Organization base currency at order creation")

    delivery_status = models.CharField(max_length=20, choices=DELIVERY_STATUS_CHOICES, default=PENDING)
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default=PAYMENT_PENDING)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), help_text="Amount received/collected so far")

    is_visible_to_staff = models.BooleanField(default=True)
    columns_config = models.JSONField(
        default=list,
        blank=True,
        help_text="Extra custom columns beyond product/description/qty/rate, e.g. "
        '[{"key": "custom_gsm", "label": "GSM"}]. Values live per-item in '
        "OrderItem.extra_data under the same key.",
    )
    copied_from = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="copies"
    )

    class Meta:
        ordering = ["-date", "-id"]
        unique_together = ("organization", "order_no")

    def __str__(self):
        return self.order_no

    @property
    def due_amount(self):
        gt = Decimal(str(self.grand_total)) if self.grand_total is not None else Decimal("0.00")
        pd = Decimal(str(self.paid_amount)) if self.paid_amount is not None else Decimal("0.00")
        return max(Decimal("0.00"), gt - pd)

    def recalc_totals(self, save=True):
        # Quantize subtotal too, not just tax_amount — qty and rate are each
        # 2-decimal-place fields, and Decimal multiplication doesn't round,
        # so an un-quantized subtotal carries 4 decimal places in memory
        # (e.g. "100.0000"). The DB column rounds it on save regardless, but
        # anything reading order.grand_total *before* a save/reload (like the
        # order-created notification message) would see the unrounded value.
        subtotal = sum((item.qty * item.rate for item in self.items.all()), Decimal("0")).quantize(Decimal("0.01"))
        tax_amount = (subtotal * self.tax_percent / Decimal("100")).quantize(Decimal("0.01"))
        self.subtotal = subtotal
        self.tax_amount = tax_amount
        self.grand_total = subtotal + tax_amount
        if self.payment_status == self.PAYMENT_PAID and (self.paid_amount is None or self.paid_amount == Decimal("0")):
            self.paid_amount = self.grand_total
        if save:
            self.save(update_fields=["subtotal", "tax_amount", "grand_total", "paid_amount"])


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, related_name="order_items")
    description = models.TextField(blank=True)
    qty = models.DecimalField(max_digits=10, decimal_places=2)
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    image = models.ImageField(upload_to="orders/items/", null=True, blank=True)
    extra_data = models.JSONField(default=dict, blank=True, help_text="Values for Order.columns_config keys.")
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    @property
    def amount(self):
        return self.qty * self.rate


class OrderImage(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="orders/images/")
    caption = models.CharField(max_length=200, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"Image for {self.order.order_no} ({self.id})"


