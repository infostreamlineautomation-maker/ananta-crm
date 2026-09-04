from django.db import models as db_models
import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response

from apps.core.modules import ORDERS
from apps.core.numbering import next_number
from apps.core.viewsets import ModuleViewSet

from .models import Order, OrderItem
from .serializers import OrderCopySerializer, OrderSerializer


def can_view_all_orders(user) -> bool:
    return user.is_superuser or (user.role_id and user.role.name == "Admin")


class OrderFilter(django_filters.FilterSet):
    min_amount = django_filters.NumberFilter(field_name="grand_total", lookup_expr="gte")
    max_amount = django_filters.NumberFilter(field_name="grand_total", lookup_expr="lte")
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    country = django_filters.NumberFilter(field_name="client__country_id")

    class Meta:
        model = Order
        fields = [
            "delivery_status",
            "payment_status",
            "client",
            "client__company",
            "supplier",
            "project",
            "min_amount",
            "max_amount",
            "date_from",
            "date_to",
            "country",
        ]


class OrderViewSet(ModuleViewSet):
    serializer_class = OrderSerializer
    module_name = ORDERS
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = OrderFilter
    search_fields = ["order_no", "description", "client__client_name", "client__company__company_name"]

    def get_queryset(self):
        qs = Order.objects.filter(organization=self.request.organization).select_related(
            "client", "supplier", "project", "created_by"
        ).prefetch_related("items__product")
        has_project = self.request.query_params.get("has_project")
        if has_project == "true":
            qs = qs.filter(project__isnull=False)
        elif has_project == "false":
            qs = qs.filter(project__isnull=True)

        user = self.request.user
        if can_view_all_orders(user):
            return qs
        return qs.filter(
            db_models.Q(created_by=user)
            | db_models.Q(is_visible_to_staff=True, created_by__is_superuser=True)
            | db_models.Q(is_visible_to_staff=True, created_by__role__name="Admin")
        )

    def perform_create(self, serializer):
        order = serializer.save(created_by=self.request.user)
        org = self.request.organization
        if org and org.notify_on_new_order:
            try:
                from apps.organizations.mailer import send_admin_alert
                action_url = f"{self.request.scheme}://{self.request.get_host()}/orders/{order.id}"
                creator_name = self.request.user.get_full_name() or self.request.user.username
                client_name = order.client.client_name if order.client else "Walk-in / None"
                send_admin_alert(
                    org=org,
                    subject=f"New Order Booked: {order.order_no} ({client_name})",
                    heading=f"New Order Created: {order.order_no}",
                    details_table={
                        "Order Number": order.order_no,
                        "Client": client_name,
                        "Date": str(order.date),
                        "Grand Total": f"{order.grand_total} {order.currency_code or org.default_currency_code}",
                        "Delivery Status": order.delivery_status.replace("_", " ").title(),
                        "Payment Status": order.payment_status.replace("_", " ").title(),
                        "Booked By": creator_name,
                    },
                    action_url=action_url,
                    action_label="View Order in CRM",
                    user=self.request.user,
                    client=order.client,
                    order=order,
                )
            except Exception:
                pass

    def perform_update(self, serializer):
        prev_instance = self.get_object()
        prev_payment_status = prev_instance.payment_status
        prev_delivery_status = prev_instance.delivery_status

        order = serializer.save()
        org = self.request.organization
        if not org:
            return

        try:
            from apps.organizations.mailer import send_admin_alert
            action_url = f"{self.request.scheme}://{self.request.get_host()}/orders/{order.id}"
            client_name = order.client.client_name if order.client else "Client"
            updater_name = self.request.user.get_full_name() or self.request.user.username

            # Payment Status Update Alert
            if org.notify_on_payment_received and prev_payment_status != order.payment_status and order.payment_status in ["paid", "partial"]:
                send_admin_alert(
                    org=org,
                    subject=f"Payment Received: Order {order.order_no} marked {order.payment_status.title()}",
                    heading=f"Payment Update: {order.order_no}",
                    details_table={
                        "Order Number": order.order_no,
                        "Client": client_name,
                        "Payment Status": order.payment_status.replace("_", " ").title(),
                        "Total Bill": f"{order.grand_total} {order.currency_code or org.default_currency_code}",
                        "Amount Received": f"{order.paid_amount} {order.currency_code or org.default_currency_code}",
                        "Outstanding Due": f"{order.due_amount} {order.currency_code or org.default_currency_code}",
                        "Updated By": updater_name,
                    },
                    action_url=action_url,
                    action_label="View Order in CRM",
                    user=self.request.user,
                    client=order.client,
                    order=order,
                )

            # Delivery Status Alert
            if org.notify_on_order_delivered and prev_delivery_status != order.delivery_status and order.delivery_status == "delivered":
                send_admin_alert(
                    org=org,
                    subject=f"Order Delivered: {order.order_no} ({client_name})",
                    heading=f"Order Delivery Completed: {order.order_no}",
                    details_table={
                        "Order Number": order.order_no,
                        "Client": client_name,
                        "Delivery Status": "Delivered",
                        "Updated By": updater_name,
                    },
                    action_url=action_url,
                    action_label="View Order in CRM",
                    user=self.request.user,
                    client=order.client,
                    order=order,
                )
        except Exception:
            pass

    @action(detail=True, methods=["post"])
    def copy(self, request, pk=None):
        """Clone an existing order into a fresh draft — the legacy "Copy
        Order" action, available to whoever can view the source order and add
        new orders."""
        source = self.get_object()
        input_serializer = OrderCopySerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        new_order = Order.objects.create(
            organization=source.organization,
            order_no=next_number(source.organization, "ORD-"),
            date=input_serializer.validated_data["date"],
            client=source.client,
            project=source.project,
            supplier=source.supplier,
            description=source.description,
            columns_config=source.columns_config,
            tax_percent=source.tax_percent,
            is_visible_to_staff=True,
            copied_from=source,
            created_by=request.user,
        )
        for i, item in enumerate(source.items.all()):
            OrderItem.objects.create(
                order=new_order,
                product=item.product,
                description=item.description,
                qty=item.qty,
                rate=item.rate,
                extra_data=item.extra_data,
                sort_order=i,
            )
        new_order.recalc_totals()
        return Response(OrderSerializer(new_order).data, status=201)


    @action(detail=True, methods=["post"], url_path="send-notification")
    def send_notification(self, request, pk=None):
        order = self.get_object()
        data = request.data
        channel = data.get("channel", "email")
        recipient = data.get("recipient", "").strip()
        subject = data.get("subject", f"Order Update - {order.order_no}").strip()
        message_body = data.get("message", "").strip()

        if not recipient:
            return Response({"detail": "Recipient is required."}, status=400)

        org = request.organization
        from apps.organizations.mailer import build_branded_html_email, send_organization_email
        from apps.organizations.models import CommunicationLog

        if channel == "email":
            # Format body paragraphs into HTML
            formatted_html = "".join(f"<p>{p.strip()}</p>" for p in message_body.split("\n\n") if p.strip()) or f"<p>{message_body}</p>"
            
            # Action button back to order/invoice
            action_url = f"{request.scheme}://{request.get_host()}/orders/{order.id}/print"
            full_html = build_branded_html_email(
                org=org,
                title=subject,
                content_html=formatted_html,
                action_url=action_url,
                action_label="View Tax Invoice / Bill",
            )
            try:
                send_organization_email(
                    org=org,
                    recipient_list=[recipient],
                    subject=subject,
                    html_content=full_html,
                    text_content=message_body,
                    user=request.user,
                    client=order.client,
                    order=order,
                )
                return Response({"detail": f"Notification email sent to {recipient}."})
            except Exception as e:
                return Response({"detail": f"Failed to send email: {str(e)}"}, status=400)

        elif channel == "whatsapp":
            CommunicationLog.objects.create(
                organization=org,
                client=order.client,
                order=order,
                channel="whatsapp",
                recipient=recipient,
                subject=subject,
                message=message_body,
                status="logged",
                sent_by=request.user,
            )
            return Response({"detail": "WhatsApp communication logged."})

        return Response({"detail": "Invalid channel."}, status=400)
