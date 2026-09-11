import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response

from apps.accounts.permissions import has_permission
from apps.core.filters import DynamicQueryFilterBackend
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
    client_group = django_filters.NumberFilter(field_name="client__groups__id", distinct=True)

    class Meta:
        model = Quotation
        fields = [
            "status",
            "client",
            "project",
            "min_amount",
            "max_amount",
            "date_from",
            "date_to",
            "country",
            "client_group",
        ]


class QuotationViewSet(SoftDeleteModuleViewSet):
    queryset = Quotation.objects.select_related("client", "project").prefetch_related("items")
    serializer_class = QuotationSerializer
    module_name = QUOTATIONS
    filter_backends = [DjangoFilterBackend, SearchFilter, DynamicQueryFilterBackend]
    filterset_class = QuotationFilter
    search_fields = ["quotation_no", "subject", "to_name", "client__client_name"]

    def perform_create(self, serializer):
        extra = {}
        if hasattr(Quotation, "created_by"):
            extra["created_by"] = self.request.user
        if hasattr(Quotation, "organization_id") and getattr(self.request, "organization", None):
            extra["organization"] = self.request.organization
        quotation = serializer.save(**extra)
        from apps.core.models import ActivityLog
        try:
            client_name = quotation.client.client_name if quotation.client else (quotation.to_name or "Client")
            ActivityLog.objects.create(
                user=self.request.user,
                module="quotations",
                object_id=str(quotation.id),
                action="created",
                details=f"Quotation {quotation.quotation_no} created for {client_name} (Subtotal: {quotation.currency_code} {quotation.subtotal:,.2f})",
            )
        except Exception:
            pass

    def perform_update(self, serializer):
        prev_instance = self.get_object()
        prev_status = prev_instance.status
        prev_subtotal = prev_instance.subtotal

        quote = serializer.save(updated_by=self.request.user)
        from apps.core.models import ActivityLog

        try:
            logged_any = False
            if prev_status != quote.status:
                logged_any = True
                ActivityLog.objects.create(
                    user=self.request.user,
                    module="quotations",
                    object_id=str(quote.id),
                    action="status_changed",
                    details=f"Quotation status changed from \"{prev_status.title()}\" to \"{quote.status.title()}\"",
                )

            if prev_subtotal != quote.subtotal:
                logged_any = True
                ActivityLog.objects.create(
                    user=self.request.user,
                    module="quotations",
                    object_id=str(quote.id),
                    action="amount_updated",
                    details=f"Quotation subtotal modified from {quote.currency_code} {prev_subtotal:,.2f} to {quote.currency_code} {quote.subtotal:,.2f}",
                )

            if not logged_any:
                ActivityLog.objects.create(
                    user=self.request.user,
                    module="quotations",
                    object_id=str(quote.id),
                    action="updated",
                    details="Quotation details and items updated",
                )
        except Exception:
            pass

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

    @action(detail=True, methods=["get"])
    def timeline(self, request, pk=None):
        """Unified chronological history & activity timeline for the quotation."""
        quotation = self.get_object()
        from apps.core.models import ActivityLog
        from apps.organizations.models import CommunicationLog

        activities = ActivityLog.objects.filter(module="quotations", object_id=str(quotation.id)).select_related("user")
        communications = CommunicationLog.objects.filter(quotation=quotation).select_related("sent_by")

        events = []
        for a in activities:
            user_name = (
                f"{a.user.first_name} {a.user.last_name}".strip()
                if a.user and (a.user.first_name or a.user.last_name)
                else (a.user.username if a.user else "System")
            )
            events.append({
                "id": f"act_{a.id}",
                "event_type": a.action,
                "title": a.action.replace("_", " ").title(),
                "description": a.details,
                "user_name": user_name,
                "created_at": a.created_at.isoformat(),
                "source": "activity",
            })

        for c in communications:
            user_name = (
                f"{c.sent_by.first_name} {c.sent_by.last_name}".strip()
                if c.sent_by and (c.sent_by.first_name or c.sent_by.last_name)
                else (c.sent_by.username if c.sent_by else "System")
            )
            events.append({
                "id": f"comm_{c.id}",
                "event_type": f"comm_{c.channel}",
                "title": f"{c.channel.title()} Proposal Sent",
                "description": f"Sent to {c.recipient} — {c.subject}" + (f": {c.message[:120]}..." if c.message else ""),
                "user_name": user_name,
                "created_at": c.created_at.isoformat(),
                "source": "communication",
            })

        events.sort(key=lambda x: x["created_at"], reverse=True)
        return Response(events)

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
            order_no=next_number(quotation.organization, getattr(quotation.organization, "order_prefix", "AG/")),
            date=input_serializer.validated_data["date"],
            client=quotation.client,
            project=quotation.project,
            currency_code=quotation.currency_code,
            exchange_rate=quotation.exchange_rate,
            base_currency_code=quotation.base_currency_code,
            description=f"From quotation {quotation.quotation_no}" + (f" — {quotation.subject}" if quotation.subject else ""),
            columns_config=quotation.columns_config or [],
            tax_percent=input_serializer.validated_data["tax_percent"],
            is_visible_to_staff=True,
            created_by=request.user,
        )

        for i, item in enumerate(quotation.items.all()):
            product_name = (item.description or f"Item {i + 1}")[:200]
            product, _ = Product.objects.get_or_create(product_name=product_name, organization=quotation.organization)
            OrderItem.objects.create(
                order=order,
                product=product,
                description=item.description,
                qty=item.qty,
                rate=item.rate,
                extra_data=item.extra_data or {},
                sort_order=i,
            )
        order.recalc_totals()

        # Mark quotation as Accepted (Won)
        prev_quote_status = quotation.status
        if quotation.status != Quotation.ACCEPTED:
            quotation.status = Quotation.ACCEPTED
            quotation.save(update_fields=["status"])

        from apps.core.models import ActivityLog
        try:
            ActivityLog.objects.create(
                user=request.user,
                module="quotations",
                object_id=str(quotation.id),
                action="converted_to_order",
                details=f"Converted to Order {order.order_no} (Grand Total: {order.currency_code} {order.grand_total:,.2f}) — Marked as Accepted (Won)",
            )
            ActivityLog.objects.create(
                user=request.user,
                module="orders",
                object_id=str(order.id),
                action="created",
                details=f"Order {order.order_no} created from Quotation {quotation.quotation_no} (Grand Total: {order.currency_code} {order.grand_total:,.2f})",
            )
        except Exception:
            pass

        # Send alert if notify_on_quote_accepted is enabled
        org = request.organization
        if org and org.notify_on_quote_accepted and prev_quote_status != "accepted":
            try:
                from apps.organizations.mailer import send_admin_alert
                action_url = f"{request.scheme}://{request.get_host()}/quotations/{quotation.id}"
                client_name = quotation.client.client_name if quotation.client else (quotation.to_name or "Client")
                updater_name = request.user.get_full_name() or request.user.username
                send_admin_alert(
                    org=org,
                    subject=f"Deal Won! Quotation {quotation.quotation_no} Converted to Order {order.order_no}",
                    heading=f"Quotation Converted to Order: {quotation.quotation_no}",
                    details_table={
                        "Quotation Number": quotation.quotation_no,
                        "Order Created": order.order_no,
                        "Client": client_name,
                        "Subtotal": f"{quotation.subtotal} {quotation.currency_code or org.default_currency_code}",
                        "Order Grand Total": f"{order.grand_total} {order.currency_code or org.default_currency_code}",
                        "Status": "Accepted (Won)",
                        "Converted By": updater_name,
                    },
                    action_url=action_url,
                    action_label="View Quotation in CRM",
                    user=request.user,
                    client=quotation.client,
                    quotation=quotation,
                    order=order,
                )
            except Exception:
                pass

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
