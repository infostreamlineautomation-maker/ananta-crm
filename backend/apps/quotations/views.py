import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response

from apps.accounts.permissions import has_permission
from apps.core.modules import ADD, ORDERS, QUOTATIONS
from apps.core.numbering import next_number
from apps.core.viewsets import SoftDeleteModuleViewSet
from apps.orders.models import Order, OrderItem
from apps.orders.serializers import OrderSerializer

from .models import Quotation
from .serializers import QuotationSerializer, QuotationToOrderSerializer


class QuotationFilter(django_filters.FilterSet):
    min_amount = django_filters.NumberFilter(field_name="subtotal", lookup_expr="gte")
    max_amount = django_filters.NumberFilter(field_name="subtotal", lookup_expr="lte")
    date_from = django_filters.DateFilter(field_name="quotation_date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="quotation_date", lookup_expr="lte")
    country = django_filters.NumberFilter(field_name="client__country_id")

    class Meta:
        model = Quotation
        fields = [
            "status",
            "client",
            "client__company",
            "project",
            "min_amount",
            "max_amount",
            "date_from",
            "date_to",
            "country",
        ]


class QuotationViewSet(SoftDeleteModuleViewSet):
    queryset = Quotation.objects.select_related("client", "project").prefetch_related("items")
    serializer_class = QuotationSerializer
    module_name = QUOTATIONS
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = QuotationFilter
    search_fields = ["quotation_no", "subject", "to_name", "client__client_name"]

    def perform_update(self, serializer):
        prev_instance = self.get_object()
        prev_status = prev_instance.status

        quote = serializer.save()
        org = self.request.organization
        if not org:
            return

        try:
            if org.notify_on_quote_accepted and prev_status != "accepted" and quote.status == "accepted":
                from apps.organizations.mailer import send_admin_alert
                action_url = f"{self.request.scheme}://{self.request.get_host()}/quotations/{quote.id}"
                client_name = quote.client.client_name if quote.client else (quote.to_name or "Client")
                updater_name = self.request.user.get_full_name() or self.request.user.username
                send_admin_alert(
                    org=org,
                    subject=f"Deal Won! Quotation {quote.quotation_no} Accepted by {client_name}",
                    heading=f"Quotation Accepted (Won): {quote.quotation_no}",
                    details_table={
                        "Quotation Number": quote.quotation_no,
                        "Client": client_name,
                        "Subject": quote.subject or "—",
                        "Subtotal": f"{quote.subtotal} {quote.currency_code or org.default_currency_code}",
                        "Status": "Accepted (Won)",
                        "Marked By": updater_name,
                    },
                    action_url=action_url,
                    action_label="View Quotation & Create Order",
                    user=self.request.user,
                    client=quote.client,
                    quotation=quote,
                )
        except Exception:
            pass

    @action(detail=True, methods=["post"], url_path="create-order")
    def create_order(self, request, pk=None):
        """"Create Order from this Quotation": copies client + line items into
        a brand new Order for review, with no stored link back to the
        quotation afterward — see the migration plan's decision to keep the
        two modules independent. Quotation line items aren't tied to a
        catalog Product (they're free-text + optional custom columns), but
        every Order line item is, so each item's description is resolved to
        a Product by name, creating one if it doesn't exist yet — the same
        "fast-track" inline-creation pattern the legacy app used everywhere."""
        if not has_permission(request.user, ORDERS, ADD):
            return Response({"detail": "You do not have permission to create orders."}, status=403)

        quotation = self.get_object()
        if not quotation.client_id:
            return Response({"detail": "This quotation has no client on file to bill the order to."}, status=400)

        input_serializer = QuotationToOrderSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        from apps.catalog.models import Product

        order = Order.objects.create(
            organization=quotation.organization,
            order_no=next_number(quotation.organization, "ORD-"),
            date=input_serializer.validated_data["date"],
            client=quotation.client,
            project=quotation.project,
            currency_code=quotation.currency_code,
            exchange_rate=quotation.exchange_rate,
            base_currency_code=quotation.base_currency_code,
            description=f"From quotation {quotation.quotation_no}",
            tax_percent=input_serializer.validated_data["tax_percent"],
            is_visible_to_staff=True,
            created_by=request.user,
        )
        for i, item in enumerate(quotation.items.all()):
            product_name = (item.description or f"Item {i + 1}")[:200]
            product, _ = Product.objects.get_or_create(product_name=product_name, organization=quotation.organization)
            OrderItem.objects.create(
                order=order, product=product, description=item.description,
                qty=item.qty, rate=item.rate, sort_order=i,
            )
        order.recalc_totals()
        return Response(OrderSerializer(order).data, status=201)

    @action(detail=True, methods=["post"], url_path="send-notification")
    def send_notification(self, request, pk=None):
        quotation = self.get_object()
        data = request.data
        channel = data.get("channel", "email")
        recipient = data.get("recipient", "").strip()
        subject = data.get("subject", f"Quotation {quotation.quotation_no} - {quotation.subject or 'Estimate'}").strip()
        message_body = data.get("message", "").strip()

        if not recipient:
            return Response({"detail": "Recipient is required."}, status=400)

        org = request.organization
        from apps.organizations.mailer import build_branded_html_email, send_organization_email
        from apps.organizations.models import CommunicationLog

        if channel == "email":
            formatted_html = "".join(f"<p>{p.strip()}</p>" for p in message_body.split("\n\n") if p.strip()) or f"<p>{message_body}</p>"
            action_url = f"{request.scheme}://{request.get_host()}/quotations/{quotation.id}/print"
            full_html = build_branded_html_email(
                org=org,
                title=subject,
                content_html=formatted_html,
                action_url=action_url,
                action_label="View Quotation / Proposal",
            )
            try:
                send_organization_email(
                    org=org,
                    recipient_list=[recipient],
                    subject=subject,
                    html_content=full_html,
                    text_content=message_body,
                    user=request.user,
                    client=quotation.client,
                    quotation=quotation,
                )
                return Response({"detail": f"Quotation email sent to {recipient}."})
            except Exception as e:
                return Response({"detail": f"Failed to send email: {str(e)}"}, status=400)

        elif channel == "whatsapp":
            CommunicationLog.objects.create(
                organization=org,
                client=quotation.client,
                quotation=quotation,
                channel="whatsapp",
                recipient=recipient,
                subject=subject,
                message=message_body,
                status="logged",
                sent_by=request.user,
            )
            return Response({"detail": "WhatsApp communication logged."})

        return Response({"detail": "Invalid channel."}, status=400)
