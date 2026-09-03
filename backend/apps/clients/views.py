from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

from apps.core.modules import CLIENTS, COMPANIES
from apps.core.viewsets import SoftDeleteModuleViewSet

from .models import Client, Company
from .serializers import ClientSerializer, CompanySerializer


class CompanyViewSet(SoftDeleteModuleViewSet):
    queryset = Company.objects.select_related("country").all()
    serializer_class = CompanySerializer
    module_name = COMPANIES
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["country"]
    search_fields = ["company_name", "contact_email", "contact_phone"]


from rest_framework.decorators import action
from rest_framework.response import Response


class ClientViewSet(SoftDeleteModuleViewSet):
    queryset = Client.objects.select_related("company", "country", "company__country").all()
    serializer_class = ClientSerializer
    module_name = CLIENTS
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["client_type", "company", "country"]
    search_fields = ["client_name", "phone", "email"]

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
