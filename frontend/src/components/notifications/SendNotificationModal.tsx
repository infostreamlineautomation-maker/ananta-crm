"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Paperclip,
  Plus,
  Receipt,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  Wallet,
  X,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch, ApiError, Paginated } from "@/lib/api";
import { useOrganization } from "@/lib/organization-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { OrderSummary, QuotationSummary } from "@/lib/types";

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
type ClientAttachMode = "general" | "quotation" | "order" | "statement";

export interface AttachedFile {
  name: string;
  size: number;
  dataUrl: string;
}

export function SendNotificationModal({ open, onClose, target, onSuccess }: SendNotificationModalProps) {
  const toast = useToast();
  const { activeOrganization } = useOrganization();
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [templateKey, setTemplateKey] = useState<string>("default");
  const [recipient, setRecipient] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);

  // Client-specific document attachment states
  const [attachMode, setAttachMode] = useState<ClientAttachMode>("general");
  const [clientQuotations, setClientQuotations] = useState<QuotationSummary[]>([]);
  const [clientOrders, setClientOrders] = useState<OrderSummary[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState<boolean>(false);
  const [selectedQuotationId, setSelectedQuotationId] = useState<number | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  // Custom File Attachments
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch client's quotations and orders if target is a client
  useEffect(() => {
    if (!open || !target || target.type !== "client") {
      setClientQuotations([]);
      setClientOrders([]);
      setAttachMode("general");
      setSelectedQuotationId(null);
      setSelectedOrderId(null);
      setAttachedFiles([]);
      return;
    }

    setLoadingDocuments(true);
    Promise.all([
      apiFetch<Paginated<QuotationSummary> | QuotationSummary[]>(`/api/quotations/?client=${target.id}&page_size=100`)
        .then((res) => ("results" in res ? res.results : res))
        .catch(() => [] as QuotationSummary[]),
      apiFetch<Paginated<OrderSummary> | OrderSummary[]>(`/api/orders/?client=${target.id}&page_size=100`)
        .then((res) => ("results" in res ? res.results : res))
        .catch(() => [] as OrderSummary[]),
    ])
      .then(([quotes, orders]) => {
        setClientQuotations(quotes || []);
        setClientOrders(orders || []);
        if (quotes && quotes.length > 0) {
          setSelectedQuotationId(quotes[0].id);
        }
        if (orders && orders.length > 0) {
          setSelectedOrderId(orders[0].id);
        }
      })
      .finally(() => {
        setLoadingDocuments(false);
      });
  }, [open, target]);

  // Selected Quotation object
  const selectedQuotation = useMemo(() => {
    if (!selectedQuotationId) return clientQuotations[0] || null;
    return clientQuotations.find((q) => q.id === selectedQuotationId) || clientQuotations[0] || null;
  }, [clientQuotations, selectedQuotationId]);

  // Selected Order object
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return clientOrders[0] || null;
    return clientOrders.find((o) => o.id === selectedOrderId) || clientOrders[0] || null;
  }, [clientOrders, selectedOrderId]);

  // Client statement calculation
  const clientStatement = useMemo(() => {
    const curr = target?.currency || activeOrganization?.default_currency_code || "INR";
    const totalOrders = clientOrders.length;
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalDue = 0;

    for (const o of clientOrders) {
      const gTotal = parseFloat(String(o.grand_total || o.subtotal || 0)) || 0;
      const pAmt = parseFloat(String(o.paid_amount || 0)) || 0;
      const dAmt = parseFloat(String(o.due_amount || 0)) || 0;
      totalInvoiced += gTotal;
      totalPaid += pAmt;
      totalDue += dAmt;
    }

    return {
      totalOrders,
      totalInvoiced,
      totalPaid,
      totalDue,
      currency: curr,
    };
  }, [clientOrders, target, activeOrganization]);

  // Initialize recipient and apply default template
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

    applyTemplate("default", channel, target, attachMode, selectedQuotation, selectedOrder, clientStatement);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, channel, attachMode, selectedQuotation, selectedOrder, clientStatement]);

  if (!target) return null;

  function getTemplates(
    t: SendNotificationTarget,
    ch: Channel,
    mode: ClientAttachMode,
    quote: QuotationSummary | null,
    ord: OrderSummary | null,
    stmt: typeof clientStatement
  ) {
    const curr = t.currency || activeOrganization?.default_currency_code || "INR";
    const origin = typeof window !== "undefined" ? window.location.origin : "";

    // Target is directly an Order or client in order attach mode
    if (t.type === "order" || (t.type === "client" && mode === "order" && ord)) {
      const orderId = t.type === "order" ? t.id : ord!.id;
      const orderNo = t.type === "order" ? (t.orderNo || `ORD-${t.id}`) : (ord!.order_no || `ORD-${ord!.id}`);
      const amountVal = t.type === "order" ? (t.amount || 0) : (ord!.grand_total || ord!.subtotal || 0);
      const dueVal = t.type === "order"
        ? (t.dueAmount !== undefined ? t.dueAmount : t.amount || 0)
        : (ord!.due_amount !== undefined ? ord!.due_amount : ord!.grand_total || 0);
      const formattedAmt = formatCurrency(amountVal, curr);
      const formattedDueAmt = formatCurrency(dueVal, curr);
      const invoiceUrl = `${origin}/orders/${orderId}/print`;

      let customOrderWa = activeOrganization?.whatsapp_order_template;
      if (customOrderWa) {
        customOrderWa = customOrderWa
          .replace(/\{client_name\}/gi, t.clientName)
          .replace(/\{order_no\}/gi, orderNo)
          .replace(/\{amount\}/gi, formattedAmt)
          .replace(/\{invoice_url\}/gi, invoiceUrl)
          .replace(/\{date\}/gi, formatDate(new Date().toISOString()));
      }

      let customPaymentWa = activeOrganization?.whatsapp_payment_template;
      if (customPaymentWa) {
        customPaymentWa = customPaymentWa
          .replace(/\{client_name\}/gi, t.clientName)
          .replace(/\{order_no\}/gi, orderNo)
          .replace(/\{amount\}/gi, formattedDueAmt)
          .replace(/\{due_amount\}/gi, formattedDueAmt)
          .replace(/\{invoice_url\}/gi, invoiceUrl);
      }

      return [
        {
          key: "default",
          name: "Tax Invoice & Bill",
          subject: `Tax Invoice & Bill - Order ${orderNo}`,
          actionUrl: invoiceUrl,
          actionLabel: "View & Download Tax Invoice",
          body:
            ch === "whatsapp"
              ? customOrderWa ||
                `*Dear ${t.clientName},*\n\nThank you for your business! Your Tax Invoice for Order *${orderNo}* (Total: *${formattedAmt}*) is ready.\n\n📄 *View & Download Tax Invoice:*\n${invoiceUrl}\n\n_Thank you for choosing ${activeOrganization?.name || "us"}!_`
              : `Dear ${t.clientName},\n\nThank you for choosing ${activeOrganization?.name || "Ananta CRM"}. We have generated the official Tax Invoice for Order ${orderNo} for a total of ${formattedAmt}.\n\nYou can review, print, and download your invoice using the link below:\n${invoiceUrl}\n\nPlease let us know if you need any further assistance.\n\nBest regards,\n${activeOrganization?.name || "Billing & Operations Team"}`,
        },
        {
          key: "payment_reminder",
          name: "Payment Reminder",
          subject: `Payment Reminder - Order ${orderNo}`,
          actionUrl: invoiceUrl,
          actionLabel: "Review Bill & Make Payment",
          body:
            ch === "whatsapp"
              ? customPaymentWa ||
                `*Dear ${t.clientName},*\n\nThis is a friendly reminder regarding the pending balance of *${formattedDueAmt}* for Order *${orderNo}*.\n\n📄 *View Bill Summary:*\n${invoiceUrl}\n\nKindly arrange the payment at your convenience. Thank you!`
              : `Dear ${t.clientName},\n\nThis is a gentle reminder regarding the outstanding balance of ${formattedDueAmt} for Order ${orderNo}.\n\nYou can review the complete invoice details at:\n${invoiceUrl}\n\nKindly let us know once the transfer is initiated.\n\nThank you for your cooperation.\n\nBest regards,\nAccounts Department`,
        },
        {
          key: "dispatched",
          name: "Dispatch & Delivery Update",
          subject: `Order Dispatched - ${orderNo}`,
          actionUrl: invoiceUrl,
          actionLabel: "View Order Status",
          body:
            ch === "whatsapp"
              ? `*Hello ${t.clientName},*\n\nGreat news! Your order *${orderNo}* has been dispatched and is on its way to you.\n\n📦 *Track / View Details:*\n${invoiceUrl}\n\nThank you!`
              : `Dear ${t.clientName},\n\nWe are pleased to inform you that your order ${orderNo} has been dispatched and is currently in transit.\n\nYou can view the full order breakdown at:\n${invoiceUrl}\n\nThank you for your business!\n\nBest regards,\nLogistics & Dispatch Team`,
        },
        {
          key: "payment_received",
          name: "Payment Received Receipt",
          subject: `Payment Received Receipt - Order ${orderNo}`,
          actionUrl: invoiceUrl,
          actionLabel: "View Updated Receipt",
          body:
            ch === "whatsapp"
              ? `*Dear ${t.clientName},*\n\nWe acknowledge with thanks the receipt of your payment for Order *${orderNo}*.\n\n📄 *Updated Receipt:*\n${invoiceUrl}\n\nThank you for your business!`
              : `Dear ${t.clientName},\n\nWe acknowledge with thanks the receipt of your payment for Order ${orderNo}.\n\nYour account has been credited. You can access your updated payment receipt here:\n${invoiceUrl}\n\nBest regards,\nAccounts Department`,
        },
        {
          key: "custom",
          name: "Custom Note",
          subject: `Update regarding Order ${orderNo}`,
          actionUrl: invoiceUrl,
          actionLabel: "View Order",
          body: `Dear ${t.clientName},\n\n`,
        },
      ];
    }

    // Target is directly a Quotation or client in quotation attach mode
    if (t.type === "quotation" || (t.type === "client" && mode === "quotation" && quote)) {
      const quoteId = t.type === "quotation" ? t.id : quote!.id;
      const quoteNo = t.type === "quotation" ? (t.quotationNo || `QT-${t.id}`) : (quote!.quotation_no || `QT-${quote!.id}`);
      const amountVal = t.type === "quotation" ? (t.amount || 0) : (quote!.subtotal || 0);
      const formattedAmt = formatCurrency(amountVal, curr);
      const quoteUrl = `${origin}/quotations/${quoteId}/print`;

      let customQuoteWa = activeOrganization?.whatsapp_quote_template;
      if (customQuoteWa) {
        customQuoteWa = customQuoteWa
          .replace(/\{client_name\}/gi, t.clientName)
          .replace(/\{quote_no\}/gi, quoteNo)
          .replace(/\{amount\}/gi, formattedAmt)
          .replace(/\{subtotal\}/gi, formattedAmt)
          .replace(/\{invoice_url\}/gi, quoteUrl)
          .replace(/\{pdf_url\}/gi, quoteUrl);
      }

      return [
        {
          key: "default",
          name: "Quotation & Proposal",
          subject: `Quotation Estimate - ${quoteNo}`,
          actionUrl: quoteUrl,
          actionLabel: "Review Quotation & Proposal",
          body:
            ch === "whatsapp"
              ? customQuoteWa ||
                `*Dear ${t.clientName},*\n\nThank you for reaching out! Please find our official Quotation *${quoteNo}* for *${formattedAmt}*.\n\n📄 *Review & Download Quotation:*\n${quoteUrl}\n\nLooking forward to your approval!`
              : `Dear ${t.clientName},\n\nThank you for your inquiry. We are pleased to present Quotation ${quoteNo} for a total estimated amount of ${formattedAmt}.\n\nYou can review, print, and approve the formal proposal at:\n${quoteUrl}\n\nPlease feel free to contact us if you require any modifications or clarifications.\n\nBest regards,\nSales & Estimations Team`,
        },
        {
          key: "followup",
          name: "Quotation Follow-Up",
          subject: `Follow-up: Quotation ${quoteNo}`,
          actionUrl: quoteUrl,
          actionLabel: "Review Quotation",
          body:
            ch === "whatsapp"
              ? `*Hello ${t.clientName},*\n\nFollowing up on our quotation *${quoteNo}* (${formattedAmt}) sent earlier. Please let us know if you have any questions or need any adjustments!\n\n📄 *View Quotation:*\n${quoteUrl}`
              : `Dear ${t.clientName},\n\nI am following up on Quotation ${quoteNo} submitted for your review.\n\nPlease let us know if the proposal aligns with your requirements or if you would like us to revise specifications.\n\nView quotation: ${quoteUrl}\n\nBest regards,\nSales Team`,
        },
        {
          key: "revised",
          name: "Revised Quotation",
          subject: `Revised Quotation - ${quoteNo}`,
          actionUrl: quoteUrl,
          actionLabel: "View Revised Proposal",
          body:
            ch === "whatsapp"
              ? `*Dear ${t.clientName},*\n\nAs requested, here is the updated and revised Quotation *${quoteNo}* (${formattedAmt}).\n\n📄 *View Revised Proposal:*\n${quoteUrl}\n\nThank you!`
              : `Dear ${t.clientName},\n\nPer our recent discussion, please find the revised and updated Quotation ${quoteNo} (${formattedAmt}).\n\nYou can review the revised pricing and specifications at:\n${quoteUrl}\n\nBest regards,\nSales Department`,
        },
        {
          key: "custom",
          name: "Custom Note",
          subject: `Update regarding Quotation ${quoteNo}`,
          actionUrl: quoteUrl,
          actionLabel: "View Quotation",
          body: `Dear ${t.clientName},\n\n`,
        },
      ];
    }

    // Client Statement Mode
    if (t.type === "client" && mode === "statement") {
      const clientUrl = `${origin}/clients/${t.id}`;
      const formattedTotalInvoiced = formatCurrency(stmt.totalInvoiced, curr);
      const formattedTotalPaid = formatCurrency(stmt.totalPaid, curr);
      const formattedTotalDue = formatCurrency(stmt.totalDue, curr);

      return [
        {
          key: "default",
          name: "Statement of Account",
          subject: `Statement of Account & Balance Summary - ${t.clientName}`,
          actionUrl: clientUrl,
          actionLabel: "View Client Account Profile",
          body:
            ch === "whatsapp"
              ? `*Dear ${t.clientName},*\n\nHere is your Statement of Account summary with ${activeOrganization?.name || "Ananta CRM"}:\n\n📋 *Total Orders:* ${stmt.totalOrders}\n💰 *Total Billed:* ${formattedTotalInvoiced}\n✅ *Total Paid:* ${formattedTotalPaid}\n⚠️ *Outstanding Balance:* *${formattedTotalDue}*\n\nView your full account profile & order history:\n${clientUrl}\n\nKindly let us know if you need invoice copies or statement reconciliation. Thank you!`
              : `Dear ${t.clientName},\n\nPlease find your Statement of Account summary below with ${activeOrganization?.name || "Ananta CRM"}:\n\n- Total Orders: ${stmt.totalOrders}\n- Total Invoiced: ${formattedTotalInvoiced}\n- Total Paid: ${formattedTotalPaid}\n- Current Outstanding Due: ${formattedTotalDue}\n\nYou can review your full order history and invoices at:\n${clientUrl}\n\nPlease let our accounts team know if you have any questions or require breakdown statements.\n\nBest regards,\nAccounts & Finance Department\n${activeOrganization?.name || "Ananta CRM"}`,
        },
        {
          key: "urgent_due",
          name: "Urgent Payment Reminder",
          subject: `Overdue Payment Notice - ${t.clientName}`,
          actionUrl: clientUrl,
          actionLabel: "View Account & Invoices",
          body:
            ch === "whatsapp"
              ? `*Dear ${t.clientName},*\n\nThis is an urgent reminder regarding your outstanding balance of *${formattedTotalDue}* across ${stmt.totalOrders} order(s).\n\nKindly arrange the settlement at your earliest convenience.\n\nAccount profile: ${clientUrl}\n\nThank you for your prompt attention!`
              : `Dear ${t.clientName},\n\nThis is a priority notice regarding the outstanding balance of ${formattedTotalDue} on your account across ${stmt.totalOrders} order(s).\n\nKindly remit payment to settle the pending dues at your earliest convenience.\n\nAccess your account and invoices here:\n${clientUrl}\n\nThank you for your prompt cooperation.\n\nBest regards,\nAccounts Department`,
        },
        {
          key: "custom",
          name: "Custom Note",
          subject: `Account Summary - ${t.clientName}`,
          actionUrl: clientUrl,
          actionLabel: "View Account",
          body: `Dear ${t.clientName},\n\n`,
        },
      ];
    }

    // General Client Message Mode
    const clientProfileUrl = `${origin}/clients/${t.id}`;
    return [
      {
        key: "default",
        name: "General Update",
        subject: `Update from ${activeOrganization?.name || "Ananta CRM"}`,
        actionUrl: clientProfileUrl,
        actionLabel: "View CRM Portal",
        body:
          ch === "whatsapp"
            ? `*Dear ${t.clientName},*\n\nGreetings from *${activeOrganization?.name || "Ananta Graphics"}*!\n\nWe hope you are having a wonderful day. Please let us know if you require any new print runs, design services, or inquiries.\n\n_Best regards,_`
            : `Dear ${t.clientName},\n\nGreetings from ${activeOrganization?.name || "Ananta CRM"}!\n\nWe hope this message finds you well. We are reaching out to see if you have any upcoming print or packaging requirements that our team can assist you with.\n\nPlease feel free to reply directly to this message.\n\nBest regards,\n${activeOrganization?.name || "Customer Success Team"}`,
      },
      {
        key: "greetings",
        name: "Greetings / Festival Wish",
        subject: `Warm Greetings from ${activeOrganization?.name || "Ananta CRM"}`,
        actionUrl: clientProfileUrl,
        actionLabel: "View Portal",
        body:
          ch === "whatsapp"
            ? `*Dear ${t.clientName},*\n\nWarmest greetings and best wishes from the entire team at *${activeOrganization?.name || "Ananta Graphics"}*! 🎉\n\nWishing you and your team continued success and prosperity.\n\n_Warm regards,_`
            : `Dear ${t.clientName},\n\nWishing you, your team, and your family joy, prosperity, and success from all of us at ${activeOrganization?.name || "Ananta CRM"}! 🎉\n\nThank you for your valued partnership and trust in our work.\n\nWarm regards,\n${activeOrganization?.name || "The Ananta Team"}`,
      },
      {
        key: "custom",
        name: "Custom Note",
        subject: `Message for ${t.clientName}`,
        actionUrl: clientProfileUrl,
        actionLabel: "View Portal",
        body: `Dear ${t.clientName},\n\n`,
      },
    ];
  }

  function applyTemplate(
    key: string,
    ch: Channel,
    t: SendNotificationTarget,
    mode: ClientAttachMode,
    quote: QuotationSummary | null,
    ord: OrderSummary | null,
    stmt: typeof clientStatement
  ) {
    setTemplateKey(key);
    const templates = getTemplates(t, ch, mode, quote, ord, stmt);
    const chosen = templates.find((tpl) => tpl.key === key) || templates[0];
    if (chosen) {
      setSubject(chosen.subject);
      setMessage(chosen.body);
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const f of Array.from(files)) {
      if (f.size > 25 * 1024 * 1024) {
        toast.error(`"${f.name}" exceeds 25MB maximum attachment size.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        setAttachedFiles((prev) => [
          ...prev,
          {
            name: f.name,
            size: f.size,
            dataUrl: String(evt.target?.result || ""),
          },
        ]);
        toast.success(`Attached "${f.name}".`);
      };
      reader.readAsDataURL(f);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachedFile = (idx: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

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
      const currTemplates = getTemplates(target!, channel, attachMode, selectedQuotation, selectedOrder, clientStatement);
      const activeTpl = currTemplates.find((t) => t.key === templateKey) || currTemplates[0];

      let quoteId: number | undefined = target?.type === "quotation" ? target.id : undefined;
      let orderId: number | undefined = target?.type === "order" ? target.id : undefined;

      if (target?.type === "client") {
        if (attachMode === "quotation" && selectedQuotation) {
          quoteId = selectedQuotation.id;
        } else if (attachMode === "order" && selectedOrder) {
          orderId = selectedOrder.id;
        }
      }

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
          order_id: orderId,
          quotation_id: quoteId,
          client_id: target?.type === "client" ? target.id : undefined,
        };

        if (target?.type === "order") {
          endpoint = `/api/orders/${target.id}/send-notification/`;
        } else if (target?.type === "quotation") {
          endpoint = `/api/quotations/${target.id}/send-notification/`;
        } else if (target?.type === "client") {
          endpoint = `/api/clients/${target.id}/send-notification/`;
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
            order_id: orderId,
            quotation_id: quoteId,
            action_url: activeTpl?.actionUrl,
            action_label: activeTpl?.actionLabel,
            attachments: attachedFiles.map((f) => ({ name: f.name, data: f.dataUrl })),
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

  const templates = getTemplates(target, channel, attachMode, selectedQuotation, selectedOrder, clientStatement);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Send Notification — ${target.title}`}
      width="max-w-4xl"
    >
      <div className="flex flex-col gap-4">
        {/* Document / Attachment Protocol Selector for Clients */}
        {target.type === "client" && (
          <div className="rounded-xl border border-primary-200/80 bg-gradient-to-r from-primary-50/40 via-surface to-surface p-3.5 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                  <Paperclip className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-ink">
                  Attach / Reference Client Document:
                </span>
              </div>

              {/* Mode Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAttachMode("general")}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border cursor-pointer",
                    attachMode === "general"
                      ? "bg-primary-600 text-white border-primary-600 shadow-xs font-bold"
                      : "bg-surface text-ink-muted border-border hover:bg-surface-hover"
                  )}
                >
                  <MessageSquare className="h-3 w-3" /> General Message
                </button>

                <button
                  type="button"
                  onClick={() => setAttachMode("quotation")}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border cursor-pointer",
                    attachMode === "quotation"
                      ? "bg-primary-600 text-white border-primary-600 shadow-xs font-bold"
                      : "bg-surface text-ink-muted border-border hover:bg-surface-hover"
                  )}
                >
                  <FileText className="h-3 w-3" /> Quotation ({clientQuotations.length})
                </button>

                <button
                  type="button"
                  onClick={() => setAttachMode("order")}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border cursor-pointer",
                    attachMode === "order"
                      ? "bg-primary-600 text-white border-primary-600 shadow-xs font-bold"
                      : "bg-surface text-ink-muted border-border hover:bg-surface-hover"
                  )}
                >
                  <Receipt className="h-3 w-3" /> Bill / Order ({clientOrders.length})
                </button>

                <button
                  type="button"
                  onClick={() => setAttachMode("statement")}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border cursor-pointer",
                    attachMode === "statement"
                      ? "bg-primary-600 text-white border-primary-600 shadow-xs font-bold"
                      : "bg-surface text-ink-muted border-border hover:bg-surface-hover"
                  )}
                >
                  <Wallet className="h-3 w-3" /> Statement of Account
                </button>
              </div>
            </div>

            {/* Sub-selectors depending on attachment mode */}
            {attachMode === "quotation" && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface rounded-lg p-2.5 border border-border">
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-bold text-ink uppercase tracking-wider">
                    Select Client Quotation / Proposal:
                  </label>
                  {clientQuotations.length > 0 ? (
                    <Select
                      value={selectedQuotationId || clientQuotations[0]?.id}
                      onChange={(e) => setSelectedQuotationId(Number(e.target.value))}
                      className="text-xs"
                    >
                      {clientQuotations.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.quotation_no} · {formatCurrency(q.subtotal, target.currency || q.currency_code)} · {formatDate(q.quotation_date)} ({q.status})
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <p className="text-xs text-ink-muted italic">No quotations found for this client.</p>
                  )}
                </div>
                {selectedQuotation && (
                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-ink-muted block">Estimate Total</span>
                    <span className="text-sm font-extrabold text-ink">
                      {formatCurrency(selectedQuotation.subtotal, target.currency || selectedQuotation.currency_code)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {attachMode === "order" && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface rounded-lg p-2.5 border border-border">
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-bold text-ink uppercase tracking-wider">
                    Select Client Order / Tax Invoice (Bill):
                  </label>
                  {clientOrders.length > 0 ? (
                    <Select
                      value={selectedOrderId || clientOrders[0]?.id}
                      onChange={(e) => setSelectedOrderId(Number(e.target.value))}
                      className="text-xs"
                    >
                      {clientOrders.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.order_no} · Total: {formatCurrency(o.grand_total || o.subtotal || 0, o.currency_code || target.currency || "INR")} · Due: {formatCurrency(o.due_amount || 0, o.currency_code || target.currency || "INR")} ({o.delivery_status})
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <p className="text-xs text-ink-muted italic">No orders found for this client.</p>
                  )}
                </div>
                {selectedOrder && (
                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-ink-muted block">Pending Due</span>
                    <span className={`text-sm font-extrabold ${Number(selectedOrder.due_amount) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {formatCurrency(selectedOrder.due_amount || 0, selectedOrder.currency_code || target.currency || "INR")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {attachMode === "statement" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-surface rounded-lg p-2.5 border border-border text-center">
                <div>
                  <span className="text-[10.5px] uppercase font-bold text-ink-faint">Total Orders</span>
                  <p className="text-sm font-extrabold text-ink mt-0.5">{clientStatement.totalOrders}</p>
                </div>
                <div>
                  <span className="text-[10.5px] uppercase font-bold text-ink-faint">Total Invoiced</span>
                  <p className="text-sm font-extrabold text-ink mt-0.5">{formatCurrency(clientStatement.totalInvoiced, target.currency)}</p>
                </div>
                <div>
                  <span className="text-[10.5px] uppercase font-bold text-ink-faint">Total Received</span>
                  <p className="text-sm font-extrabold text-emerald-600 mt-0.5">{formatCurrency(clientStatement.totalPaid, target.currency)}</p>
                </div>
                <div>
                  <span className="text-[10.5px] uppercase font-bold text-ink-faint">Outstanding Due</span>
                  <p className={`text-sm font-extrabold mt-0.5 ${clientStatement.totalDue > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {formatCurrency(clientStatement.totalDue, target.currency)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

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
                onClick={() => applyTemplate(tpl.key, channel, target, attachMode, selectedQuotation, selectedOrder, clientStatement)}
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

              {/* Upload Custom Files */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-ink flex items-center gap-1">
                    <Paperclip className="h-3.5 w-3.5 text-primary-600" /> Attach Files (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 cursor-pointer"
                  >
                    + Upload File
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.doc"
                />

                {attachedFiles.length > 0 ? (
                  <div className="flex flex-col gap-1 max-h-24 overflow-y-auto pr-1">
                    {attachedFiles.map((f, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 rounded border border-border bg-surface px-2 py-1 text-xs"
                      >
                        <span className="truncate text-ink font-medium">{f.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-ink-muted">{(f.size / 1024).toFixed(0)} KB</span>
                          <button
                            type="button"
                            onClick={() => removeAttachedFile(idx)}
                            className="text-ink-faint hover:text-rose-600 p-0.5 rounded cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-border rounded-lg p-2.5 text-center text-xs text-ink-muted hover:bg-surface-hover cursor-pointer transition flex items-center justify-center gap-1.5"
                  >
                    <UploadCloud className="h-4 w-4 text-ink-faint" />
                    <span>Attach PDF, mockup or spreadsheet</span>
                  </div>
                )}
              </div>
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
                  ? "Opens WhatsApp Web/App pre-formatted with bold styling and direct view links, and logs the communication into your CRM history."
                  : "Sends directly via your SMTP server with an interactive branded call-to-action button and records communication logs."}
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
              rows={11}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              className="font-sans text-xs leading-relaxed flex-1 w-full min-h-[220px]"
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
