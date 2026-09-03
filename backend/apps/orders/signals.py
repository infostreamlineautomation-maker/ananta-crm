"""Creates real Notification rows when order state actually changes — the
legacy app had no notifications table at all and recomputed "notifications"
from order state on every page load within a rolling 28-day window. This is
event-sourced instead: a row is written once, when something happens."""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.notifications.models import Notification

from .models import Order


@receiver(pre_save, sender=Order)
def _stash_previous_state(sender, instance, **kwargs):
    if instance.pk:
        try:
            previous = Order.objects.get(pk=instance.pk)
            instance._previous_delivery_status = previous.delivery_status
            instance._previous_payment_status = previous.payment_status
        except Order.DoesNotExist:
            instance._previous_delivery_status = None
            instance._previous_payment_status = None
    else:
        instance._previous_delivery_status = None
        instance._previous_payment_status = None


@receiver(post_save, sender=Order)
def _notify_on_order_change(sender, instance, created, **kwargs):
    # Order-created notifications are fired explicitly by OrderSerializer.create()
    # once totals are computed (items don't exist yet at the instant this row is
    # first inserted, so grand_total isn't final here) — this handler only
    # covers status changes on an existing order.
    if created:
        return

    prev_payment = getattr(instance, "_previous_payment_status", None)
    if prev_payment and prev_payment != instance.payment_status and instance.payment_status == Order.PAYMENT_PAID:
        Notification.objects.create(
            organization=instance.organization,
            event_type=Notification.PAYMENT_RECEIVED,
            title=f"Payment received for {instance.order_no}",
            message=instance.client.client_name,
            order=instance,
        )

    prev_delivery = getattr(instance, "_previous_delivery_status", None)
    if prev_delivery and prev_delivery != instance.delivery_status:
        if instance.delivery_status == Order.IN_PROCESS:
            event_type, label = Notification.DELIVERY_IN_PROCESS, "In Process"
        elif instance.delivery_status == Order.PENDING:
            event_type, label = Notification.DELIVERY_PENDING, "Pending"
        else:
            return
        Notification.objects.create(
            organization=instance.organization,
            event_type=event_type,
            title=f"{instance.order_no} delivery is now {label}",
            message=instance.client.client_name,
            order=instance,
        )
