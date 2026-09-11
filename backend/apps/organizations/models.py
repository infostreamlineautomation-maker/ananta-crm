from django.conf import settings
from django.db import models


class Organization(models.Model):
    """A business running on this CRM instance — e.g. Ananta Graphics and
    Meewa Industries share one install, one login system, and identical
    functionality, but every business record (clients, orders, products,
    suppliers, projects, quotations, costing) belongs to exactly one
    Organization. Switching the active organization (see middleware.py)
    swaps the entire data set a user sees, the same way switching a Slack
    workspace does.

    This also absorbs what used to be the standalone AppSettings singleton —
    branding and quotation defaults are naturally per-business, not global,
    once there's more than one business."""

    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    logo = models.ImageField(upload_to="organizations/logos/", null=True, blank=True)
    primary_color = models.CharField(max_length=7, default="#C31432", help_text="Hex, e.g. #C31432")
    tagline = models.CharField(max_length=200, blank=True)

    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)

    default_currency_code = models.CharField(max_length=3, default="INR")
    default_tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    order_prefix = models.CharField(max_length=20, default="AG/", blank=True)
    quotation_prefix = models.CharField(max_length=20, default="AG/")
    quotation_intro = models.TextField(blank=True)
    quotation_terms = models.TextField(blank=True)
    quotation_signature_name = models.CharField(max_length=150, blank=True)
    quotation_designation = models.CharField(max_length=150, blank=True)
    quotation_contact_person = models.CharField(max_length=150, blank=True)
    quotation_background_image = models.ImageField(upload_to="organizations/quotations/", null=True, blank=True)
    quotation_signature_image = models.ImageField(upload_to="organizations/quotations/", null=True, blank=True)

    # SMTP / Email Configuration
    smtp_host = models.CharField(max_length=200, blank=True, help_text="e.g. smtp.gmail.com")
    smtp_port = models.IntegerField(default=587, help_text="587 for TLS, 465 for SSL")
    smtp_user = models.CharField(max_length=200, blank=True)
    smtp_password = models.CharField(max_length=200, blank=True)
    smtp_use_tls = models.BooleanField(default=True)
    smtp_use_ssl = models.BooleanField(default=False)
    smtp_from_email = models.EmailField(blank=True, help_text="e.g. billing@company.com")
    smtp_from_name = models.CharField(max_length=150, blank=True, help_text="e.g. Ananta Graphics")

    # Admin Email Notification & Alert Preferences
    notify_admin_email = models.EmailField(blank=True, help_text="Recipient email address for internal admin alerts")
    notify_on_new_order = models.BooleanField(default=True, help_text="Send email alert when staff books a new order")
    notify_on_order_delivered = models.BooleanField(default=False, help_text="Send email alert when order is marked delivered")
    notify_on_quote_accepted = models.BooleanField(default=True, help_text="Send email alert when a quote is accepted/won")
    notify_on_payment_received = models.BooleanField(default=True, help_text="Send email alert when order payment is received/paid")

    # WhatsApp Messaging & Template Configuration
    whatsapp_number = models.CharField(max_length=30, blank=True, help_text="Official WhatsApp Business phone number")
    whatsapp_default_country_code = models.CharField(max_length=10, default="+91", help_text="Default dial code, e.g. +91")
    whatsapp_order_template = models.TextField(blank=True, help_text="Custom default template for order confirmation")
    whatsapp_quote_template = models.TextField(blank=True, help_text="Custom default template for quotations")
    whatsapp_payment_template = models.TextField(blank=True, help_text="Custom default template for payment reminders")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class OrganizationMembership(models.Model):
    """Which users can access which organizations. A superuser can access
    every organization regardless of membership rows (same bypass pattern as
    RBAC elsewhere in this app) — this table is what grants a *non-superuser*
    access to more than one business."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="organization_memberships")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "organization")

    def __str__(self):
        return f"{self.user} @ {self.organization}"


class CommunicationLog(models.Model):
    CHANNEL_CHOICES = [
        ("email", "Email"),
        ("whatsapp", "WhatsApp"),
    ]
    STATUS_CHOICES = [
        ("sent", "Sent"),
        ("failed", "Failed"),
        ("logged", "Logged (WhatsApp)"),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="communications")
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, null=True, blank=True, related_name="communications")
    order = models.ForeignKey("orders.Order", on_delete=models.SET_NULL, null=True, blank=True, related_name="communications")
    quotation = models.ForeignKey("quotations.Quotation", on_delete=models.SET_NULL, null=True, blank=True, related_name="communications")

    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    recipient = models.CharField(max_length=200, help_text="Email address or phone number")
    subject = models.CharField(max_length=255, blank=True)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="sent")
    error_message = models.TextField(blank=True)
    sent_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.channel}] to {self.recipient} at {self.created_at}"
