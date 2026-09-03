from django.conf import settings
from django.db import models


class Notification(models.Model):
    """A real, persisted event log — the legacy app had no notifications table
    at all and recomputed "notifications" from order state on every request
    within a rolling 28-day window. This is created by signal handlers in the
    orders/quotations apps when the relevant state actually changes, which
    also opens the door to email/WhatsApp delivery later without touching
    this model."""

    ORDER_CREATED = "order_created"
    PAYMENT_PENDING = "payment_pending"
    PAYMENT_RECEIVED = "payment_received"
    DELIVERY_PENDING = "delivery_pending"
    DELIVERY_IN_PROCESS = "delivery_in_process"
    EVENT_TYPE_CHOICES = [
        (ORDER_CREATED, "Order Created"),
        (PAYMENT_PENDING, "Payment Pending"),
        (PAYMENT_RECEIVED, "Payment Received"),
        (DELIVERY_PENDING, "Delivery Pending"),
        (DELIVERY_IN_PROCESS, "Delivery In Process"),
    ]

    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="notifications")
    event_type = models.CharField(max_length=30, choices=EVENT_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    message = models.CharField(max_length=500, blank=True)
    order = models.ForeignKey(
        "orders.Order", null=True, blank=True, on_delete=models.CASCADE, related_name="notifications"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class NotificationRead(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_reads")
    notification = models.ForeignKey(Notification, on_delete=models.CASCADE, related_name="reads")
    read_at = models.DateTimeField(null=True, blank=True)
    is_dismissed = models.BooleanField(default=False)

    class Meta:
        unique_together = ("user", "notification")
