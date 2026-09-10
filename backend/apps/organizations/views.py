from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import has_permission
from apps.core.modules import EDIT, SETTINGS, VIEW

from .middleware import _available_organizations, user_can_access
from .models import Organization
from .serializers import OrganizationSerializer, OrganizationSettingsSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mine(request):
    """Every organization this user can access, plus which one is active —
    what the sidebar switcher renders."""
    orgs = _available_organizations(request.user)
    return Response(
        {
            "organizations": OrganizationSerializer(orgs, many=True, context={"request": request}).data,
            "active_organization_id": request.organization.id if request.organization else None,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def switch(request):
    org_id = request.data.get("organization")
    if not user_can_access(request.user, org_id):
        return Response({"detail": "You don't have access to that organization."}, status=403)
    request.session["active_organization_id"] = int(org_id)
    org = Organization.objects.get(id=org_id)
    return Response(OrganizationSerializer(org, context={"request": request}).data)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def settings_view(request):
    """Read/update the *active* organization's settings — same request/
    response shape the old standalone AppSettings endpoint had, so the
    frontend Settings page works against whichever business is selected
    without needing to change."""
    if request.organization is None:
        return Response({"detail": "No active organization."}, status=400)

    if request.method == "GET":
        if not has_permission(request.user, SETTINGS, VIEW):
            return Response({"detail": "You do not have permission to view settings."}, status=403)
        return Response(OrganizationSettingsSerializer(request.organization, context={"request": request}).data)

    if not has_permission(request.user, SETTINGS, EDIT):
        return Response({"detail": "You do not have permission to edit settings."}, status=403)
    old_currency = request.organization.default_currency_code
    serializer = OrganizationSettingsSerializer(
        request.organization, data=request.data, partial=True, context={"request": request}
    )
    serializer.is_valid(raise_exception=True)
    updated_org = serializer.save()

    if updated_org.default_currency_code != old_currency or "default_currency_code" in request.data:
        from apps.core.forex import sync_exchange_rates
        sync_exchange_rates(updated_org)

    return Response(OrganizationSettingsSerializer(request.organization, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def test_email_view(request):
    """Verify SMTP credentials by sending a test email."""
    if not has_permission(request.user, SETTINGS, EDIT):
        return Response({"detail": "Permission denied."}, status=403)

    recipient = request.data.get("recipient_email")
    if not recipient:
        return Response({"detail": "recipient_email is required."}, status=400)

    org = request.organization
    if not org or not org.smtp_host:
        return Response({"detail": "SMTP settings are not configured yet. Please configure and save Host, Port, and Credentials first."}, status=400)

    from .mailer import build_branded_html_email, send_organization_email

    subject = f"Test Email from {org.name} CRM"
    content = f"""
    <p>Hello,</p>
    <p>This is a test notification confirming that your <strong>SMTP Email Server</strong> for <strong>{org.name}</strong> is configured correctly and working properly.</p>
    <p>You can now send automated order confirmations, tax invoices, and quotation notifications directly to your clients.</p>
    """
    html_body = build_branded_html_email(org, "SMTP Email Verification", content)

    try:
        send_organization_email(
            org=org,
            recipient_list=[recipient],
            subject=subject,
            html_content=html_body,
            text_content="Your SMTP Email configuration is working correctly.",
            user=request.user,
        )
        return Response({"detail": f"Test email successfully sent to {recipient}."})
    except Exception as e:
        err_msg = str(e)
        if "SendAsDenied" in err_msg or "5.2.252" in err_msg:
            err_msg = (
                f"Microsoft 365 Send-As Denied: The authenticated account '{org.smtp_user}' is not permitted by Exchange to send as '{org.smtp_from_email}'. "
                f"To resolve, set 'From Email Address' to '{org.smtp_user}', or grant 'Send As' permission in Microsoft 365 Admin Center."
            )
        elif "Authentication unsuccessful" in err_msg or "535" in err_msg:
            err_msg = "SMTP Authentication Failed: Please verify your Username and Password. If 2FA is enabled on your email account, generate and use an App Password."
        return Response({"detail": f"SMTP Error: {err_msg}"}, status=400)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def communications_list_view(request):
    """List communication logs for the active organization."""
    from .models import CommunicationLog
    from .serializers import CommunicationLogSerializer

    qs = CommunicationLog.objects.filter(organization=request.organization)

    client_id = request.query_params.get("client")
    if client_id:
        qs = qs.filter(client_id=client_id)

    order_id = request.query_params.get("order")
    if order_id:
        qs = qs.filter(order_id=order_id)

    quotation_id = request.query_params.get("quotation")
    if quotation_id:
        qs = qs.filter(quotation_id=quotation_id)

    channel = request.query_params.get("channel")
    if channel:
        qs = qs.filter(channel=channel)

    qs = qs.order_by("-created_at")[:100]
    return Response(CommunicationLogSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def log_communication_view(request):
    """Log an external message (e.g. WhatsApp Web send) in the CRM."""
    from .models import CommunicationLog
    from .serializers import CommunicationLogSerializer

    data = request.data
    channel = data.get("channel", "whatsapp")
    recipient = data.get("recipient", "")
    message = data.get("message", "")
    subject = data.get("subject", "")
    client_id = data.get("client_id") or data.get("client")
    order_id = data.get("order_id") or data.get("order")
    quotation_id = data.get("quotation_id") or data.get("quotation")

    log = CommunicationLog.objects.create(
        organization=request.organization,
        client_id=client_id,
        order_id=order_id,
        quotation_id=quotation_id,
        channel=channel,
        recipient=recipient,
        subject=subject,
        message=message,
        status="logged" if channel == "whatsapp" else "sent",
        sent_by=request.user,
    )
    return Response(CommunicationLogSerializer(log).data, status=201)
