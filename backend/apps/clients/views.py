from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter
from apps.core.filters import DynamicQueryFilterBackend
from apps.core.modules import CLIENTS, COMPANIES
from apps.core.viewsets import SoftDeleteModuleViewSet
from .models import Client, ClientGroup, Company
from .serializers import ClientGroupSerializer, ClientSerializer, CompanySerializer


class ClientGroupViewSet(SoftDeleteModuleViewSet):
    queryset = ClientGroup.objects.prefetch_related("clients").all()
    serializer_class = ClientGroupSerializer
    module_name = CLIENTS
    filter_backends = [DjangoFilterBackend, SearchFilter, DynamicQueryFilterBackend]
    search_fields = ["name", "description"]

    def perform_create(self, serializer):
        extra = {}
        if hasattr(ClientGroup, "created_by"):
            extra["created_by"] = self.request.user
        if hasattr(ClientGroup, "organization_id") and getattr(self.request, "organization", None):
            extra["organization"] = self.request.organization
        group = serializer.save(**extra)


class CompanyViewSet(SoftDeleteModuleViewSet):
    queryset = Company.objects.select_related("country").all()
    serializer_class = CompanySerializer
    module_name = COMPANIES
    filter_backends = [DjangoFilterBackend, SearchFilter, DynamicQueryFilterBackend]
    filterset_fields = ["country"]
    search_fields = ["company_name", "contact_name", "gstin", "msin_number", "vat_id", "reg_no", "contact_email", "contact_phone"]


from rest_framework.decorators import action
from rest_framework.response import Response


class ClientViewSet(SoftDeleteModuleViewSet):
    queryset = Client.objects.select_related("company", "country", "company__country").prefetch_related("groups").all()
    serializer_class = ClientSerializer
    module_name = CLIENTS
    filter_backends = [DjangoFilterBackend, SearchFilter, DynamicQueryFilterBackend]
    filterset_fields = ["client_type", "company", "country", "groups"]
    search_fields = ["client_name", "phone", "email"]

    def perform_create(self, serializer):
        extra = {}
        if hasattr(Client, "created_by"):
            extra["created_by"] = self.request.user
        if hasattr(Client, "organization_id") and getattr(self.request, "organization", None):
            extra["organization"] = self.request.organization
        client = serializer.save(**extra)
        from apps.core.models import ActivityLog
        try:
            ActivityLog.objects.create(
                user=self.request.user,
                module="clients",
                object_id=str(client.id),
                action="created",
                details=f"Client account \"{client.client_name}\" registered",
            )
        except Exception:
            pass

    def perform_update(self, serializer):
        client = serializer.save(updated_by=self.request.user)
        from apps.core.models import ActivityLog
        try:
            ActivityLog.objects.create(
                user=self.request.user,
                module="clients",
                object_id=str(client.id),
                action="updated",
                details=f"Client profile \"{client.client_name}\" details updated",
            )
        except Exception:
            pass

    @action(detail=True, methods=["get"])
    def timeline(self, request, pk=None):
        """Unified 360-degree relationship & activity timeline for the client."""
        client = self.get_object()
        from apps.core.models import ActivityLog
        from apps.organizations.models import CommunicationLog
        from apps.orders.models import Order
        from apps.quotations.models import Quotation

        # 1. Direct client activities
        client_acts = ActivityLog.objects.filter(module="clients", object_id=str(client.id)).select_related("user")

        # 2. Client orders activities
        order_ids = [str(o_id) for o_id in Order.objects.filter(client=client).values_list("id", flat=True)]
        order_acts = ActivityLog.objects.filter(module="orders", object_id__in=order_ids).select_related("user") if order_ids else []

        # 3. Client quotations activities
        quote_ids = [str(q_id) for q_id in Quotation.objects.filter(client=client).values_list("id", flat=True)]
        quote_acts = ActivityLog.objects.filter(module="quotations", object_id__in=quote_ids).select_related("user") if quote_ids else []

        # 4. Communications sent to this client
        comms = CommunicationLog.objects.filter(client=client).select_related("sent_by")

        events = []
        for a in list(client_acts) + list(order_acts) + list(quote_acts):
            user_name = (
                f"{a.user.first_name} {a.user.last_name}".strip()
                if a.user and (a.user.first_name or a.user.last_name)
                else (a.user.username if a.user else "System")
            )
            title = a.action.replace("_", " ").title()
            if a.module == "orders":
                title = f"Order: {title}"
            elif a.module == "quotations":
                title = f"Quotation: {title}"

            events.append({
                "id": f"act_{a.id}",
                "event_type": a.action,
                "title": title,
                "description": a.details,
                "user_name": user_name,
                "created_at": a.created_at.isoformat(),
                "source": "activity",
            })

        for c in comms:
            user_name = (
                f"{c.sent_by.first_name} {c.sent_by.last_name}".strip()
                if c.sent_by and (c.sent_by.first_name or c.sent_by.last_name)
                else (c.sent_by.username if c.sent_by else "System")
            )
            events.append({
                "id": f"comm_{c.id}",
                "event_type": f"comm_{c.channel}",
                "title": f"{c.channel.title()} Sent",
                "description": f"To {c.recipient} — {c.subject}" + (f": {c.message[:120]}..." if c.message else ""),
                "user_name": user_name,
                "created_at": c.created_at.isoformat(),
                "source": "communication",
            })

        events.sort(key=lambda x: x["created_at"], reverse=True)
        return Response(events)

    @action(detail=True, methods=["post"], url_path="send-notification")
    def send_notification(self, request, pk=None):
        client = self.get_object()
        data = request.data
        channel = data.get("channel", "email")
        recipient = data.get("recipient", "").strip() or (client.email if channel == "email" else client.phone)
        subject = data.get("subject", f"Message from {request.organization.name}").strip()
        message_body = data.get("message", "").strip()

        if not recipient:
            return Response({"detail": "Recipient is required."}, status=400)

        org = request.organization
        from apps.organizations.mailer import build_branded_html_email, send_organization_email
        from apps.organizations.models import CommunicationLog

        if channel == "email":
            formatted_html = "".join(f"<p>{p.strip()}</p>" for p in message_body.split("\n\n") if p.strip()) or f"<p>{message_body}</p>"
            full_html = build_branded_html_email(
                org=org,
                title=subject,
                content_html=formatted_html,
            )
            try:
                send_organization_email(
                    org=org,
                    recipient_list=[recipient],
                    subject=subject,
                    html_content=full_html,
                    text_content=message_body,
                    user=request.user,
                    client=client,
                )
                return Response({"detail": f"Email sent to {recipient}."})
            except Exception as e:
                return Response({"detail": f"Failed to send email: {str(e)}"}, status=400)

        elif channel == "whatsapp":
            CommunicationLog.objects.create(
                organization=org,
                client=client,
                channel="whatsapp",
                recipient=recipient,
                subject=subject,
                message=message_body,
                status="logged",
                sent_by=request.user,
            )
            return Response({"detail": "WhatsApp communication logged."})

        return Response({"detail": "Invalid channel."}, status=400)
