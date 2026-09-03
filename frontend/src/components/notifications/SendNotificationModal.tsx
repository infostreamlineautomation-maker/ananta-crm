"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Mail, MessageSquare, Send, Sparkles } from "lucide-react";
import clsx from "clsx";
import { apiFetch, ApiError } from "@/lib/api";
import { useOrganization } from "@/lib/organization-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";

export interface SendNotificationTarget {
  type: "order" | "quotation" | "client";
  id: number;
  title: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  orderNo?: string;
  quotationNo?: string;
  amount?: string | number;
  paidAmount?: string | number;
  dueAmount?: string | number;
  currency?: string;
  date?: string;
  status?: string;
}

interface SendNotificationModalProps {
  open: boolean;
  onClose: () => void;
  target: SendNotificationTarget | null;
  onSuccess?: () => void;
}

type Channel = "whatsapp" | "email";

export function SendNotificationModal({ open, onClose, target, onSuccess }: SendNotificationModalProps) {
  const toast = useToast();
  const { activeOrganization } = useOrganization();
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [templateKey, setTemplateKey] = useState<string>("default");
  const [recipient, setRecipient] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);

  // Initialize form fields whenever target changes
  useEffect(() => {
    if (!target) return;

    if (channel === "whatsapp") {
      let phone = (target.clientPhone || "").trim();
      const defaultCode = activeOrganization?.whatsapp_default_country_code || "+91";
      if (phone && !phone.startsWith("+") && !phone.startsWith("00")) {
        const cleanCode = defaultCode.replace(/[^\d+]/g, "");
        const digitsOnly = phone.replace(/[^\d]/g, "");
        if (!digitsOnly.startsWith(cleanCode.replace("+", ""))) {
          phone = `${cleanCode} ${phone}`;
        }
      }
      setRecipient(phone);
    } else {
      setRecipient(target.clientEmail || "");
    }

    applyTemplate("default", channel, target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, channel]);

  if (!target) return null;

  function getTemplates(t: SendNotificationTarget, ch: Channel) {
    const curr = t.currency || activeOrganization?.default_currency_code || "INR";
    const formattedAmt = t.amount ? formatCurrency(t.amount, curr) : "";
    const formattedDueAmt = t.dueAmount !== undefined ? formatCurrency(t.dueAmount, curr) : formattedAmt;
    const origin = typeof window !== "undefined" ? window.location.origin : "";

    if (t.type === "order") {
      let customOrderWa = activeOrganization?.whatsapp_order_template;
      if (customOrderWa) {
        customOrderWa = customOrderWa
          .replace(/\{client_name\}/gi, t.clientName)
          .replace(/\{order_no\}/gi, t.orderNo || "")
          .replace(/\{amount\}/gi, formattedAmt)
          .replace(/\{invoice_url\}/gi, `${origin}/orders/${t.id}/print`)
          .replace(/\{date\}/gi, t.date ? formatDate(t.date) : "");
      }

      let customPaymentWa = activeOrganization?.whatsapp_payment_template;
      if (customPaymentWa) {
        customPaymentWa = customPaymentWa
          .replace(/\{client_name\}/gi, t.clientName)
          .replace(/\{order_no\}/gi, t.orderNo || "")
          .replace(/\{amount\}/gi, formattedDueAmt)
          .replace(/\{due_amount\}/gi, formattedDueAmt)
          .replace(/\{invoice_url\}/gi, `${origin}/orders/${t.id}/print`);
      }

      return [
        {
          key: "default",
          name: "Order Confirmation & Bill",
          subject: `Order Confirmation - ${t.orderNo}`,
          body:
            ch === "whatsapp"
              ? customOrderWa ||
                `*Dear ${t.clientName},*\n\nThank you for your order! Your order *${t.orderNo}* for *${formattedAmt}* has been confirmed.\n\nYou can view and download your Tax Invoice here:\n${origin}/orders/${t.id}/print\n\n_Thank you for choosing us!_`
              : `Dear ${t.clientName},\n\nThank you for your business! Your order ${t.orderNo} has been confirmed for a total amount of ${formattedAmt}.\n\nYour order is currently being processed by our production team. You can view your invoice directly using the link below.\n\nPlease let us know if you have any questions.\n\nBest regards,\n${activeOrganization?.name || "Ananta CRM Team"}`,
        },
        {
          key: "dispatched",
          name: "Dispatch & Delivery Update",
          subject: `Order Dispatched - ${t.orderNo}`,
          body:
            ch === "whatsapp"
              ? `*Hello ${t.clientName},*\n\nGreat news! Your order *${t.orderNo}* has been dispatched and is on its way to you.\n\nView details: ${origin}/orders/${t.id}/print\n\nPlease reach out if you need any assistance!`
              : `Dear ${t.clientName},\n\nWe are pleased to inform you that your order ${t.orderNo} has been dispatched and is on its way.\n\nYou can view the full order details and invoice here:\n${origin}/orders/${t.id}/print\n\nThank you for your patience!\n\nBest regards,\n${activeOrganization?.name || "Ananta CRM Team"}`,
        },
        {
          key: "payment_reminder",
          name: "Payment Reminder",
          subject: `Payment Reminder - Order ${t.orderNo}`,
          body:
            ch === "whatsapp"
              ? customPaymentWa ||
                `*Dear ${t.clientName},*\n\nThis is a friendly reminder regarding the pending balance payment of *${formattedDueAmt}* for Order *${t.orderNo}*.\n\nPlease review your bill here: ${origin}/orders/${t.id}/print\n\nKindly let us know once the transfer is made. Thank you!`
              : `Dear ${t.clientName},\n\nThis is a gentle reminder regarding the outstanding balance of ${formattedDueAmt} for Order ${t.orderNo}.\n\nYou can review your invoice and order summary at:\n${origin}/orders/${t.id}/print\n\nKindly remit payment at your earliest convenience or reply to this email if you have already processed it.\n\nThank you for your cooperation.\n\nBest regards,\nAccounts Team`,
        },
        {
          key: "payment_received",
          name: "Payment Received Receipt",
          subject: `Payment Received - Order ${t.orderNo}`,
          body:
            ch === "whatsapp"
              ? `*Dear ${t.clientName},*\n\nWe have received your payment for Order *${t.orderNo}*. Thank you very much!\n\nView updated receipt: ${origin}/orders/${t.id}/print`
              : `Dear ${t.clientName},\n\nWe acknowledge with thanks the receipt of your payment for Order ${t.orderNo}.\n\nYour account has been credited. You can review your updated receipt at:\n${origin}/orders/${t.id}/print\n\nThank you for your business!\n\nBest regards,\nAccounts Department`,
        },
        {
          key: "custom",
          name: "Custom Message",
          subject: `Update regarding Order ${t.orderNo}`,
          body: `Dear ${t.clientName},\n\n`,
        },
      ];
    } else if (t.type === "quotation") {
      let customQuoteWa = activeOrganization?.whatsapp_quote_template;
      if (customQuoteWa) {
        customQuoteWa = customQuoteWa
          .replace(/\{client_name\}/gi, t.clientName)
          .replace(/\{quote_no\}/gi, t.quotationNo || "")
          .replace(/\{amount\}/gi, formattedAmt)
          .replace(/\{subtotal\}/gi, formattedAmt)
          .replace(/\{invoice_url\}/gi, `${origin}/quotations/${t.id}/print`)
          .replace(/\{pdf_url\}/gi, `${origin}/quotations/${t.id}/print`);
      }

      return [
        {
          key: "default",
          name: "Quotation & Proposal",
          subject: `Quotation Estimate - ${t.quotationNo}`,
          body:
            ch === "whatsapp"
              ? customQuoteWa ||
                `*Dear ${t.clientName},*\n\nPlease find our quotation *${t.quotationNo}* for *${formattedAmt}*.\n\nYou can review the complete estimate and breakdown here:\n${origin}/quotations/${t.id}/print\n\nLooking forward to your feedback!`
              : `Dear ${t.clientName},\n\nThank you for your inquiry. We are pleased to provide you with Quotation ${t.quotationNo} amounting to ${formattedAmt}.\n\nYou can view and download the official proposal at:\n${origin}/quotations/${t.id}/print\n\nPlease feel free to contact us if you require any modifications or clarifications.\n\nBest regards,\nSales Team`,
        },
        {
          key: "followup",
          name: "Quotation Follow-Up",
          subject: `Follow-up: Quotation ${t.quotationNo}`,
          body:
            ch === "whatsapp"
              ? `*Hello ${t.clientName},*\n\nFollowing up on our quotation *${t.quotationNo}* sent recently. Let us know if you have any questions or need any adjustments!\n\nLink: ${origin}/quotations/${t.id}/print`
              : `Dear ${t.clientName},\n\nI am following up on Quotation ${t.quotationNo} submitted for your review.\n\nPlease let us know if the proposal aligns with your requirements or if you would like us to make any adjustments.\n\nView quotation: ${origin}/quotations/${t.id}/print\n\nBest regards,\nSales Team`,
        },
        {
          key: "custom",
          name: "Custom Message",
          subject: `Update regarding Quotation ${t.quotationNo}`,
          body: `Dear ${t.clientName},\n\n`,
        },
      ];
    } else {
      return [
        {
          key: "default",
          name: "General Message",
          subject: `Update for ${t.clientName}`,
          body: `Dear ${t.clientName},\n\n`,
        },
        {
          key: "custom",
          name: "Custom Message",
          subject: `Message for ${t.clientName}`,
          body: `Dear ${t.clientName},\n\n`,
        },
      ];
    }
  }

  function applyTemplate(key: string, ch: Channel, t: SendNotificationTarget) {
    setTemplateKey(key);
    const templates = getTemplates(t, ch);
    const chosen = templates.find((tpl) => tpl.key === key) || templates[0];
    if (chosen) {
      setSubject(chosen.subject);
      setMessage(chosen.body);
    }
  }

  async function handleSend() {
    if (!recipient.trim()) {
      toast.error(channel === "whatsapp" ? "Please provide a phone number." : "Please provide an email address.");
      return;
    }
    if (!message.trim()) {
      toast.error("Message content cannot be empty.");
      return;
    }

    setSending(true);
    try {
      if (channel === "whatsapp") {
        // Clean phone number
        const cleanPhone = recipient.replace(/[^\d+]/g, "").replace(/^0+/, "");
        const encodedText = encodeURIComponent(message);
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;

        // Log to CRM backend
        let endpoint = "/api/communications/log/";
        const body: Record<string, any> = {
          channel: "whatsapp",
          recipient: cleanPhone,
          subject: subject || "WhatsApp Message",
          message,
        };

        if (target?.type === "order") {
          endpoint = `/api/orders/${target.id}/send-notification/`;
          body.order_id = target.id;
        } else if (target?.type === "quotation") {
          endpoint = `/api/quotations/${target.id}/send-notification/`;
          body.quotation_id = target.id;
        } else if (target?.type === "client") {
          endpoint = `/api/clients/${target.id}/send-notification/`;
          body.client_id = target.id;
        }

        await apiFetch(endpoint, {
          method: "POST",
          body: JSON.stringify(body),
        });

        // Open WhatsApp Web
        window.open(waUrl, "_blank", "noopener,noreferrer");
        toast.success("WhatsApp message ready & logged in CRM!");
        onSuccess?.();
        onClose();
      } else {
        // Send via SMTP Email
        let endpoint = `/api/orders/${target?.id}/send-notification/`;
        if (target?.type === "quotation") {
          endpoint = `/api/quotations/${target.id}/send-notification/`;
        } else if (target?.type === "client") {
          endpoint = `/api/clients/${target.id}/send-notification/`;
        }

        await apiFetch(endpoint, {
          method: "POST",
          body: JSON.stringify({
            channel: "email",
            recipient: recipient.trim(),
            subject: subject.trim(),
            message: message.trim(),
          }),
        });

        toast.success(`Email successfully sent to ${recipient}!`);
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send notification. Check SMTP settings.");
    } finally {
      setSending(false);
    }
  }

  const templates = getTemplates(target, channel);

  return (
    <Modal open={open} onClose={onClose} title={`Send Notification — ${target.title}`} width="max-w-4xl">
      <div className="flex flex-col gap-4">
        {/* Top Header Controls: Channel & Templates */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-border">
          {/* Channel Switcher */}
          <div className="inline-flex rounded-lg bg-surface-sunken p-1 text-xs font-semibold self-start">
            <button
              type="button"
              onClick={() => setChannel("whatsapp")}
              className={clsx(
                "flex items-center gap-2 rounded-md px-3.5 py-1.5 transition-all cursor-pointer",
                channel === "whatsapp"
                  ? "bg-white text-emerald-600 shadow-xs font-bold ring-1 ring-emerald-200"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp (1-Click)
            </button>
            <button
              type="button"
              onClick={() => setChannel("email")}
              className={clsx(
                "flex items-center gap-2 rounded-md px-3.5 py-1.5 transition-all cursor-pointer",
                channel === "email"
                  ? "bg-white text-primary-600 shadow-xs font-bold ring-1 ring-primary-200"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              <Mail className="h-3.5 w-3.5 text-primary-600" /> Email (SMTP Server)
            </button>
          </div>

          {/* Template Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mr-0.5">Template:</span>
            {templates.map((tpl) => (
              <button
                key={tpl.key}
                type="button"
                onClick={() => applyTemplate(tpl.key, channel, target)}
                className={clsx(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-all border cursor-pointer",
                  templateKey === tpl.key
                    ? "border-primary-500 bg-primary-50 text-primary-700 font-bold shadow-xs"
                    : "border-border bg-surface hover:bg-surface-hover text-ink-muted"
                )}
              >
                <Sparkles className="h-3 w-3" />
                {tpl.name}
              </button>
            ))}
          </div>
        </div>

        {/* 2-Column Body */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
          {/* Left Column (5 cols): Destination & Settings */}
          <div className="md:col-span-5 flex flex-col gap-3 justify-between">
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  {channel === "whatsapp" ? "Client WhatsApp Number" : "Recipient Email Address"}
                </label>
                <Input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={channel === "whatsapp" ? "+91 98765 43210" : "client@example.com"}
                  className="text-xs"
                />
              </div>

              {channel === "email" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">Email Subject Line</label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject..."
                    className="text-xs"
                  />
                </div>
              )}
            </div>

            {/* Quick Context Card */}
            <div className="rounded-lg border border-border/80 bg-surface-sunken p-3 text-[11.5px] text-ink-muted">
              <p className="font-bold text-ink mb-1 flex items-center gap-1.5">
                {channel === "whatsapp" ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    WhatsApp 1-Click Message
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-primary-500" />
                    Automated SMTP Email Delivery
                  </>
                )}
              </p>
              <p className="leading-relaxed text-ink-muted">
                {channel === "whatsapp"
                  ? "Clicking Send opens WhatsApp Web or App pre-filled with the message and records this communication in your CRM history."
                  : "Dispatches the message directly to your client via your configured business email server."}
              </p>
            </div>
          </div>

          {/* Right Column (7 cols): Message Content Box */}
          <div className="md:col-span-7 flex flex-col">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-ink">
              <span>Message Content</span>
              <span className="text-[11px] font-normal text-ink-faint">Editable prior to dispatch</span>
            </div>
            <Textarea
              rows={9}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              className="font-sans text-xs leading-relaxed flex-1 w-full min-h-[190px]"
            />
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between border-t border-border pt-3 mt-1">
          <p className="text-[11px] text-ink-faint hidden sm:block">
            Target: <span className="font-semibold text-ink">{target.clientName}</span> ({target.title})
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={sending} className="text-xs px-3.5 py-1.5">
              Cancel
            </Button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className={clsx(
                "inline-flex items-center justify-center gap-2 rounded-md px-5 py-2 text-xs font-bold text-white transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                channel === "whatsapp"
                  ? "bg-[#25D366] hover:bg-[#1EBE5D] text-white"
                  : "bg-primary-600 hover:bg-primary-700 text-white"
              )}
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : channel === "whatsapp" ? (
                <MessageSquare className="h-3.5 w-3.5 text-white" />
              ) : (
                <Send className="h-3.5 w-3.5 text-white" />
              )}
              <span>{channel === "whatsapp" ? "Send on WhatsApp" : "Send Email Now"}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
