"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  MessageSquareQuote,
  XCircle,
  Printer,
  FileText,
  AlertCircle,
  Clock,
  Building2,
  User,
  Paperclip,
  Check,
  Send,
  Loader2,
  Calendar,
  Layers,
} from "lucide-react";
import { QuotationDetail, QuotationItemDetail } from "@/lib/types";
import { formatCurrency, formatDate, mediaUrl } from "@/lib/format";
import { apiFetch, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

interface ClientQuotationPortalViewProps {
  quotation: QuotationDetail;
  onUpdate?: (updated: QuotationDetail) => void;
}

export function ClientQuotationPortalView({
  quotation,
  onUpdate,
}: ClientQuotationPortalViewProps) {
  const toast = useToast();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Revision modal state
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState("");

  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Accept confirm modal state
  const [showAcceptModal, setShowAcceptModal] = useState(false);

  const currency = quotation.currency_code || "INR";

  const statusConfig: Record<
    string,
    { label: string; bg: string; text: string; icon: any }
  > = {
    draft: {
      label: "Pending Review",
      bg: "bg-amber-50 border-amber-200",
      text: "text-amber-800",
      icon: Clock,
    },
    sent: {
      label: "Awaiting Your Approval",
      bg: "bg-blue-50 border-blue-200",
      text: "text-blue-800",
      icon: Clock,
    },
    accepted: {
      label: "Approved & Confirmed",
      bg: "bg-emerald-50 border-emerald-200",
      text: "text-emerald-800",
      icon: CheckCircle2,
    },
    revision_requested: {
      label: "Revision Requested",
      bg: "bg-purple-50 border-purple-200",
      text: "text-purple-800",
      icon: MessageSquareQuote,
    },
    rejected: {
      label: "Declined",
      bg: "bg-rose-50 border-rose-200",
      text: "text-rose-800",
      icon: XCircle,
    },
  };

  const currentStatus = statusConfig[quotation.status] || {
    label: quotation.status,
    bg: "bg-slate-50 border-slate-200",
    text: "text-slate-800",
    icon: Clock,
  };

  const StatusIcon = currentStatus.icon;

  async function handleAccept() {
    setLoadingAction("accept");
    try {
      const res = await apiFetch<{ detail: string; status: string }>(
        `/api/quotations/${quotation.id}/accept/`,
        { method: "POST" }
      );
      toast.success(res.detail || "Quotation approved successfully!");
      setShowAcceptModal(false);
      if (onUpdate) {
        onUpdate({
          ...quotation,
          status: "accepted",
          accepted_at: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to accept quotation");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleRequestRevision() {
    if (!revisionFeedback.trim()) {
      toast.error("Please enter your revision notes or requested changes.");
      return;
    }
    setLoadingAction("revision");
    try {
      const res = await apiFetch<{ detail: string; status: string }>(
        `/api/quotations/${quotation.id}/request-revision/`,
        {
          method: "POST",
          body: JSON.stringify({ feedback: revisionFeedback }),
        }
      );
      toast.success(res.detail || "Revision request sent to our team!");
      setShowRevisionModal(false);
      if (onUpdate) {
        onUpdate({
          ...quotation,
          status: "revision_requested",
          client_feedback: revisionFeedback,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit revision request");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleReject() {
    setLoadingAction("reject");
    try {
      const res = await apiFetch<{ detail: string; status: string }>(
        `/api/quotations/${quotation.id}/reject/`,
        {
          method: "POST",
          body: JSON.stringify({ reason: rejectReason }),
        }
      );
      toast.success(res.detail || "Quotation declined.");
      setShowRejectModal(false);
      if (onUpdate) {
        onUpdate({
          ...quotation,
          status: "rejected",
          client_feedback: rejectReason,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to decline quotation");
    } finally {
      setLoadingAction(null);
    }
  }

  const isActionable =
    quotation.status === "sent" ||
    quotation.status === "draft" ||
    quotation.status === "revision_requested";

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl border ${currentStatus.bg} ${currentStatus.text}`}
          >
            <StatusIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-xl font-extrabold tracking-tight text-ink">
                {quotation.quotation_no}
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${currentStatus.bg} ${currentStatus.text}`}
              >
                {currentStatus.label}
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              Issued on {formatDate(quotation.quotation_date)}
              {quotation.accepted_at && (
                <> · Approved on {formatDate(quotation.accepted_at)}</>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={`/quotations/${quotation.id}/print`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-ink transition hover:bg-surface-hover hover:border-line-focus shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Download / Print PDF
          </Link>

          {isActionable && (
            <>
              <button
                type="button"
                onClick={() => setShowRevisionModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 shadow-xs"
              >
                <MessageSquareQuote className="h-3.5 w-3.5 text-amber-700" />
                Suggest Edits / Request Revision
              </button>

              <button
                type="button"
                onClick={() => setShowAcceptModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 shadow-sm"
              >
                <Check className="h-4 w-4" />
                Approve & Confirm Quote
              </button>

              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                <XCircle className="h-3.5 w-3.5 text-rose-500" />
                Decline
              </button>
            </>
          )}
        </div>
      </div>

      {/* Revision notice if any */}
      {quotation.status === "revision_requested" && quotation.client_feedback && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-4.5 text-sm text-purple-900">
          <div className="flex items-start gap-3">
            <MessageSquareQuote className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" />
            <div>
              <p className="font-semibold text-purple-950">
                Your Revision Request:
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-purple-900">
                {quotation.client_feedback}
              </p>
              <p className="mt-2 text-[11px] text-purple-700">
                Our team is reviewing your notes and will update the quotation shortly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Accepted notice if any */}
      {quotation.status === "accepted" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4.5 text-sm text-emerald-900">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-950">
                Quotation Approved
              </p>
              <p className="mt-0.5 text-xs text-emerald-800">
                Thank you! You approved this quotation on{" "}
                {formatDate(quotation.accepted_at || quotation.updated_at)}. Our production
                team has been notified and is proceeding with your job.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Quotation Sheet (Letterhead Style) */}
      <div className="rounded-2xl border border-line bg-surface p-7 shadow-sm md:p-10">
        {/* Recipient & Quotation Info Grid */}
        <div className="grid grid-cols-1 gap-6 border-b border-line pb-8 sm:grid-cols-2">
          {/* Client Details */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Quotation For
            </p>
            <h2 className="mt-1.5 text-base font-bold text-ink">
              {quotation.to_name || quotation.client_name || "Valued Client"}
            </h2>
            {quotation.company_name && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted mt-0.5">
                <Building2 className="h-3 w-3" />
                {quotation.company_name}
              </p>
            )}
            {(quotation.to_address || quotation.client_address) && (
              <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-ink-faint">
                {quotation.to_address || quotation.client_address}
              </p>
            )}
          </div>

          {/* Quotation Details */}
          <div className="space-y-2 text-right sm:border-l sm:border-line sm:pl-6">
            <div>
              <span className="text-xs text-ink-muted">Quotation Number: </span>
              <span className="font-mono text-xs font-bold text-ink">
                {quotation.quotation_no}
              </span>
            </div>
            <div>
              <span className="text-xs text-ink-muted">Date: </span>
              <span className="text-xs font-semibold text-ink">
                {formatDate(quotation.quotation_date)}
              </span>
            </div>
            {quotation.project_name && (
              <div>
                <span className="text-xs text-ink-muted">Project / Reference: </span>
                <span className="text-xs font-semibold text-ink">
                  {quotation.project_name}
                </span>
              </div>
            )}
            <div>
              <span className="text-xs text-ink-muted">Currency: </span>
              <span className="font-mono text-xs font-bold text-ink">
                {currency}
              </span>
            </div>
          </div>
        </div>

        {/* Subject & Intro */}
        {(quotation.subject || quotation.intro_text) && (
          <div className="border-b border-line py-6">
            {quotation.subject && (
              <h3 className="text-sm font-bold text-ink">
                Subject: {quotation.subject}
              </h3>
            )}
            {quotation.intro_text && (
              <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-ink-muted">
                {quotation.intro_text}
              </p>
            )}
          </div>
        )}

        {/* Line Items Table */}
        <div className="mt-6 overflow-hidden rounded-xl border border-line">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-surface-muted/60 font-semibold text-ink">
              <tr>
                <th className="w-12 px-4 py-3 text-center">#</th>
                <th className="px-4 py-3">Description / Item</th>
                <th className="w-28 px-4 py-3 text-right">
                  {quotation.col_qty_label || "Quantity"}
                </th>
                <th className="w-32 px-4 py-3 text-right">
                  {quotation.col_rate_label || "Unit Rate"}
                </th>
                <th className="w-36 px-4 py-3 text-right">Total ({currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {quotation.items && quotation.items.length > 0 ? (
                quotation.items.map((item: QuotationItemDetail, idx: number) => {
                  const qtyNum = parseFloat(item.qty) || 0;
                  const rateNum = parseFloat(item.rate) || 0;
                  const itemAmount =
                    item.amount != null
                      ? parseFloat(item.amount)
                      : qtyNum * rateNum;

                  return (
                    <tr key={item.id || idx} className="hover:bg-surface-hover/50">
                      <td className="px-4 py-3.5 text-center font-mono text-ink-muted">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-ink">
                          {item.product_name || "Custom Specification"}
                        </div>
                        {item.description && (
                          <p className="mt-0.5 whitespace-pre-wrap text-[11px] leading-relaxed text-ink-muted">
                            {item.description}
                          </p>
                        )}
                        {/* Custom fields / specs like Paper, Finish, Size */}
                        {item.extra_data && Object.keys(item.extra_data).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {Object.entries(item.extra_data).map(([k, v]) => {
                              if (!v) return null;
                              return (
                                <span
                                  key={k}
                                  className="inline-flex rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-ink-muted"
                                >
                                  <span className="capitalize">{k.replace(/_/g, " ")}</span>:{" "}
                                  <span className="ml-1 font-semibold text-ink">{v}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="tnum px-4 py-3.5 text-right font-mono text-ink">
                        {item.qty || "1"}
                      </td>
                      <td className="tnum px-4 py-3.5 text-right font-mono text-ink">
                        {formatCurrency(rateNum, currency)}
                      </td>
                      <td className="tnum px-4 py-3.5 text-right font-mono font-bold text-ink">
                        {formatCurrency(itemAmount, currency)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-ink-faint">
                    No items specified in this quotation.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bulk Quantity & Price Comparison Table if present */}
        {(() => {
          const quantityTiers = (quotation.detailed_costing_data?.quantity_tiers || []).filter(
            (t) => t.include_in_whatsapp !== false
          );
          if (quantityTiers.length === 0) return null;

          return (
            <div className="mt-6 overflow-hidden rounded-xl border border-line bg-surface shadow-2xs">
              <div className="flex items-center gap-2 border-b border-line bg-surface-muted/60 px-4 py-3">
                <Layers className="h-4 w-4 text-primary-600" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                    Bulk Quantity &amp; Price Comparison
                  </h4>
                  <p className="text-[11px] text-ink-muted">
                    Per-piece rate and total pricing across bulk order volumes
                  </p>
                </div>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-surface-muted/30 font-semibold text-ink-muted">
                  <tr>
                    <th className="px-4 py-2.5 text-center w-12">#</th>
                    <th className="px-4 py-2.5">Order Quantity</th>
                    <th className="px-4 py-2.5 text-right">Unit Rate / pc</th>
                    <th className="px-4 py-2.5 text-right">Total Amount ({currency})</th>
                    <th className="px-4 py-2.5 text-left">Remarks / Benefits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {quantityTiers.map((tier, idx) => {
                    const qNum = Number(tier.qty || 0);
                    const rateNum = parseFloat(tier.unit_rate || "0");
                    const totalNum = parseFloat(tier.total_amount || "0");
                    return (
                      <tr key={tier.id || idx} className="hover:bg-surface-hover/50">
                        <td className="px-4 py-3 text-center font-mono text-ink-muted">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3 font-bold font-mono text-ink">
                          {qNum > 0 ? qNum.toLocaleString() : tier.qty} pcs
                        </td>
                        <td className="tnum px-4 py-3 text-right font-mono font-bold text-emerald-700">
                          {formatCurrency(rateNum, currency)}
                        </td>
                        <td className="tnum px-4 py-3 text-right font-mono font-black text-ink">
                          {formatCurrency(totalNum, currency)}
                        </td>
                        <td className="px-4 py-3 text-ink-muted">
                          {tier.notes || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* Financial Summary */}
        <div className="mt-6 flex flex-col justify-end border-t border-line pt-6 sm:flex-row">
          <div className="w-full sm:w-80 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>Subtotal</span>
              <span className="font-mono font-semibold text-ink">
                {formatCurrency(quotation.subtotal || 0, currency)}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-line pt-2 text-sm">
              <span className="font-bold text-ink">Total Amount</span>
              <span className="font-mono text-base font-extrabold text-primary-600">
                {formatCurrency(quotation.subtotal || 0, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        {(quotation.notes || quotation.footer_content) && (
          <div className="mt-8 rounded-xl border border-line bg-surface-muted/30 p-5 text-xs text-ink-muted space-y-3">
            {quotation.notes && (
              <div>
                <p className="font-bold text-ink">Terms & Notes:</p>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                  {quotation.notes}
                </p>
              </div>
            )}
            {quotation.footer_content && (
              <div className="border-t border-line/60 pt-3">
                <p className="whitespace-pre-wrap leading-relaxed">
                  {quotation.footer_content}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Attachments Section if any */}
        {quotation.attachments && quotation.attachments.length > 0 && (
          <div className="mt-8 border-t border-line pt-6">
            <p className="flex items-center gap-1.5 text-xs font-bold text-ink">
              <Paperclip className="h-3.5 w-3.5 text-ink-muted" />
              Attachments ({quotation.attachments.length})
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {quotation.attachments.map((att, idx) => (
                <a
                  key={att.id || idx}
                  href={att.file_url || att.file || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl border border-line bg-surface p-3 text-xs transition hover:border-line-focus hover:bg-surface-hover"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="h-4 w-4 shrink-0 text-primary-600" />
                    <span className="truncate font-medium text-ink">
                      {att.file_name || att.annexure_title || `Attachment #${idx + 1}`}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-primary-600">
                    Download
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Accept Confirmation Modal */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mb-4">
              <Check className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-ink">
              Approve Quotation {quotation.quotation_no}?
            </h3>
            <p className="mt-2 text-xs text-ink-muted leading-relaxed">
              By confirming, you approve this quotation for{" "}
              <strong className="text-ink">
                {formatCurrency(quotation.subtotal || 0, currency)}
              </strong>
              . Our team will immediately be notified and begin processing your order.
            </p>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowAcceptModal(false)}
                disabled={loadingAction === "accept"}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAccept}
                disabled={loadingAction === "accept"}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loadingAction === "accept" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggest Edits / Request Revision Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2 text-amber-700">
                <MessageSquareQuote className="h-5 w-5" />
                <h3 className="text-base font-bold text-ink">
                  Suggest Edits / Request Revision
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRevisionModal(false)}
                className="text-ink-muted hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-xs text-ink-muted leading-relaxed">
              Describe the modifications you would like (e.g. adjust quantities, change paper stock, update delivery date, or pricing inquiries). Our team will review your comments and issue an updated quotation.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-ink mb-1.5">
                Your Feedback / Requested Changes *
              </label>
              <textarea
                rows={4}
                value={revisionFeedback}
                onChange={(e) => setRevisionFeedback(e.target.value)}
                placeholder="E.g., Please change the quantity to 1,000 units and quote for 350 GSM Art Card..."
                className="w-full rounded-xl border border-line bg-surface p-3 text-xs text-ink placeholder:text-ink-faint focus:border-primary-500 focus:outline-hidden"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowRevisionModal(false)}
                disabled={loadingAction === "revision"}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestRevision}
                disabled={loadingAction === "revision" || !revisionFeedback.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {loadingAction === "revision" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 mb-4">
              <XCircle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-ink">
              Decline Quotation {quotation.quotation_no}?
            </h3>
            <p className="mt-2 text-xs text-ink-muted leading-relaxed">
              If this quotation no longer meets your requirements, you can decline it. You may optionally provide a reason for our team.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-ink mb-1.5">
                Reason (Optional)
              </label>
              <textarea
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="E.g., Project cancelled or found an alternative..."
                className="w-full rounded-xl border border-line bg-surface p-2.5 text-xs text-ink placeholder:text-ink-faint focus:border-primary-500 focus:outline-hidden"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                disabled={loadingAction === "reject"}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={loadingAction === "reject"}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {loadingAction === "reject" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Decline Quotation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
