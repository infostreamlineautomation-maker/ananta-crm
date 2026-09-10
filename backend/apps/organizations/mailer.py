import logging
from django.core.mail import EmailMultiAlternatives
from django.core.mail.backends.smtp import EmailBackend
from django.utils.html import escape

from .models import CommunicationLog

logger = logging.getLogger(__name__)


def get_organization_email_backend(org):
    """Instantiate a Django SMTP EmailBackend configured with the organization's credentials."""
    if not org or not org.smtp_host:
        return None
    return EmailBackend(
        host=org.smtp_host,
        port=org.smtp_port or 587,
        username=org.smtp_user or None,
        password=org.smtp_password or None,
        use_tls=bool(org.smtp_use_tls),
        use_ssl=bool(org.smtp_use_ssl),
        timeout=12,
        fail_silently=False,
    )


def build_branded_html_email(org, title, content_html, action_url=None, action_label=None):
    """Wraps body content in a clean, high-conversion responsive email template."""
    company_name = escape(org.name if org else "Ananta CRM")
    primary_color = org.primary_color if (org and org.primary_color) else "#C31432"
    contact_phone = escape(org.contact_phone if org and org.contact_phone else "")
    contact_email = escape(org.contact_email if org and org.contact_email else "")
    address = escape(org.address if org and org.address else "")

    action_btn_html = ""
    if action_url and action_label:
        action_btn_html = f"""
        <div style="margin: 32px 0 24px 0; text-align: center;">
            <a href="{escape(action_url)}" target="_blank" style="display: inline-block; background-color: {primary_color}; color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                {escape(action_label)}
            </a>
        </div>
        """

    footer_contacts = []
    if contact_phone:
        footer_contacts.append(f"Tel: {contact_phone}")
    if contact_email:
        footer_contacts.append(f"Email: {contact_email}")
    footer_contact_str = " &nbsp;|&nbsp; ".join(footer_contacts)

    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{escape(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f5f7; padding: 32px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
                    <!-- Brand Header Bar -->
                    <tr>
                        <td style="background-color: {primary_color}; padding: 24px 32px; text-align: left;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">
                                {company_name}
                            </h1>
                            {f'<p style="margin: 4px 0 0 0; color: rgba(255,255,255,0.85); font-size: 12px;">{escape(org.tagline)}</p>' if org and org.tagline else ''}
                        </td>
                    </tr>

                    <!-- Email Body -->
                    <tr>
                        <td style="padding: 32px 32px 24px 32px;">
                            <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 18px; font-weight: 700;">
                                {escape(title)}
                            </h2>
                            <div style="font-size: 14px; color: #334155; line-height: 1.65;">
                                {content_html}
                            </div>
                            {action_btn_html}
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
                            <p style="margin: 0 0 4px 0; font-weight: 600; color: #475569;">{company_name}</p>
                            {f'<p style="margin: 0 0 4px 0;">{address}</p>' if address else ''}
                            {f'<p style="margin: 0;">{footer_contact_str}</p>' if footer_contact_str else ''}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


def send_organization_email(org, recipient_list, subject, html_content, text_content=None, user=None, client=None, order=None, quotation=None):
    """Sends an email via the organization's SMTP backend and creates a CommunicationLog entry."""
    if not isinstance(recipient_list, list):
        recipient_list = [recipient_list]

    if not org.smtp_host:
        err = "SMTP server is not configured for this organization. Please set up SMTP in Settings."
        for r in recipient_list:
            CommunicationLog.objects.create(
                organization=org,
                client=client,
                order=order,
                quotation=quotation,
                channel="email",
                recipient=r,
                subject=subject,
                message=text_content or html_content,
                status="failed",
                error_message=err,
                sent_by=user,
            )
        raise ValueError(err)

    backend = get_organization_email_backend(org)
    from_name = org.smtp_from_name or org.name or "Ananta CRM"
    from_email = org.smtp_from_email or org.smtp_user or "no-reply@anantagraphics.com"
    full_from = f"{from_name} <{from_email}>" if from_name else from_email

    reply_to_email = org.smtp_from_email or org.contact_email or org.smtp_user
    reply_to_list = [reply_to_email] if reply_to_email else None

    plain_text = text_content or "Please view this email with an HTML-compatible client."

    msg = EmailMultiAlternatives(
        subject=subject,
        body=plain_text,
        from_email=full_from,
        to=recipient_list,
        reply_to=reply_to_list,
        connection=backend,
    )
    msg.attach_alternative(html_content, "text/html")

    try:
        try:
            msg.send(fail_silently=False)
        except Exception as e:
            err_str = str(e)
            # Handle Microsoft 365 / Exchange / Gmail SendAsDenied when from_email != smtp_user
            if (
                ("SendAsDenied" in err_str or "5.2.252" in err_str or "not allowed to send as" in err_str.lower())
                and org.smtp_user
                and from_email.strip().lower() != org.smtp_user.strip().lower()
            ):
                logger.warning(
                    "SMTP server denied SendAs for %s. Retrying using authenticated user %s as sender with Reply-To=%s...",
                    from_email,
                    org.smtp_user,
                    from_email,
                )
                fallback_from = f"{from_name} <{org.smtp_user}>" if from_name else org.smtp_user
                msg.from_email = fallback_from
                msg.reply_to = [from_email]
                msg.send(fail_silently=False)
            else:
                raise e

        for r in recipient_list:
            CommunicationLog.objects.create(
                organization=org,
                client=client,
                order=order,
                quotation=quotation,
                channel="email",
                recipient=r,
                subject=subject,
                message=text_content or html_content,
                status="sent",
                sent_by=user,
            )
        return True
    except Exception as e:
        logger.exception("Failed to send email via organization SMTP")
        err = str(e)
        for r in recipient_list:
            CommunicationLog.objects.create(
                organization=org,
                client=client,
                order=order,
                quotation=quotation,
                channel="email",
                recipient=r,
                subject=subject,
                message=text_content or html_content,
                status="failed",
                error_message=err,
                sent_by=user,
            )
        raise e


def send_admin_alert(org, subject, heading, details_table, action_url=None, action_label="View in CRM", user=None, client=None, order=None, quotation=None):
    """Dispatches an administrative notification to org.notify_admin_email or org.contact_email."""
    if not org:
        return False
    admin_email = org.notify_admin_email or org.contact_email
    if not admin_email or not org.smtp_host:
        return False

    rows_html = "".join([
        f'<tr><td style="padding: 8px 12px; font-weight: 600; color: #475569; width: 150px; border-bottom: 1px solid #f1f5f9;">{escape(k)}</td>'
        f'<td style="padding: 8px 12px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">{escape(str(v))}</td></tr>'
        for k, v in details_table.items()
    ])

    body_html = f"""
    <p style="margin: 0 0 16px 0; color: #334155; font-size: 14px;">
        An important event has occurred in <strong>{escape(org.name)}</strong>:
    </p>
    <table role="presentation" width="100%" style="border-collapse: collapse; background-color: #f8fafc; border-radius: 8px; overflow: hidden; margin-bottom: 20px; font-size: 13px;">
        {rows_html}
    </table>
    """

    full_html = build_branded_html_email(org, heading, body_html, action_url=action_url, action_label=action_label)

    try:
        return send_organization_email(
            org=org,
            recipient_list=[admin_email],
            subject=f"[CRM Alert] {subject}",
            html_content=full_html,
            text_content=f"{heading}\n\n" + "\n".join([f"{k}: {v}" for k, v in details_table.items()]),
            user=user,
            client=client,
            order=order,
            quotation=quotation,
        )
    except Exception as e:
        logger.warning(f"Could not deliver admin alert email: {e}")
        return False
