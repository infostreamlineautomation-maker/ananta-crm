"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Package,
  Clock,
  CheckCircle2,
  Truck,
  Printer,
  Calendar,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  Building2,
  DollarSign,
  Maximize2,
  Eye,
} from "lucide-react";
import { OrderDetail, OrderImage, OrderItemDetail } from "@/lib/types";
import { formatCurrency, formatDate, mediaUrl } from "@/lib/format";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";

interface ClientOrderPortalViewProps {
  order: OrderDetail;
}

export function ClientOrderPortalView({ order }: ClientOrderPortalViewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const currency = order.currency_code || "INR";
  const dueAmountNum = parseFloat(order.due_amount || "0");
  const paidAmountNum = parseFloat(order.paid_amount || "0");
  const grandTotalNum = parseFloat(order.grand_total || "0");

  // Determine active milestone index (0 to 3)
  // 0: Order Placed
  // 1: In Production / Processing
  // 2: Ready for Dispatch / Pickup
  // 3: Delivered
  const getMilestoneIndex = () => {
    switch (order.delivery_status) {
      case "delivered":
        return 3;
      case "ready":
        return 2;
      case "in_process":
        return 1;
      case "pending":
      default:
        return 0;
    }
  };

  const currentStep = getMilestoneIndex();

  const steps = [
    { title: "Order Placed", desc: `Confirmed on ${formatDate(order.date)}` },
    { title: "In Production", desc: "Printing & fabrication in progress" },
    { title: "Quality Check & Ready", desc: "Packed & ready for dispatch" },
    { title: "Delivered", desc: "Successfully delivered to you" },
  ];

  const deliveryStatusConfig: Record<
    string,
    { label: string; bg: string; text: string; icon: any }
  > = {
    pending: {
      label: "Order Received",
      bg: "bg-blue-50 border-blue-200",
      text: "text-blue-800",
      icon: Clock,
    },
    in_process: {
      label: "In Production",
      bg: "bg-amber-50 border-amber-200",
      text: "text-amber-800",
      icon: Package,
    },
    ready: {
      label: "Ready for Delivery",
      bg: "bg-purple-50 border-purple-200",
      text: "text-purple-800",
      icon: CheckCircle2,
    },
    delivered: {
      label: "Delivered",
      bg: "bg-emerald-50 border-emerald-200",
      text: "text-emerald-800",
      icon: Truck,
    },
  };

  const paymentStatusConfig: Record<
    string,
    { label: string; bg: string; text: string }
  > = {
    pending: {
      label: "Payment Pending",
      bg: "bg-rose-50 border-rose-200 text-rose-800",
      text: "text-rose-800",
    },
    advance: {
      label: "Advance Paid",
      bg: "bg-sky-50 border-sky-200 text-sky-800",
      text: "text-sky-800",
    },
    partial: {
      label: "Partially Paid",
      bg: "bg-amber-50 border-amber-200 text-amber-800",
      text: "text-amber-800",
    },
    paid: {
      label: "Fully Paid",
      bg: "bg-emerald-50 border-emerald-200 text-emerald-800",
      text: "text-emerald-800",
    },
  };

  const deliveryBadge = deliveryStatusConfig[order.delivery_status] || deliveryStatusConfig.pending;
  const paymentBadge = paymentStatusConfig[order.payment_status] || paymentStatusConfig.pending;
  const DeliveryIcon = deliveryBadge.icon;

  const images: { id?: number; image: string; caption?: string }[] = (order.images || [])
    .map((img) => ({
      id: img.id,
      image: mediaUrl(img.image) || "",
      caption: img.caption || order.project_title || order.order_no || "",
    }))
    .filter((img) => Boolean(img.image));

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl border ${deliveryBadge.bg} ${deliveryBadge.text}`}
          >
            <DeliveryIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-extrabold tracking-tight text-ink">
                {order.order_no}
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${deliveryBadge.bg} ${deliveryBadge.text}`}
              >
                {deliveryBadge.label}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${paymentBadge.bg}`}
              >
                {paymentBadge.label}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink-muted">
              {order.project_title || order.project_name || "Order Project"} · Placed on {formatDate(order.date)}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div>
          <Link
            href={`/orders/${order.id}/print`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-ink transition hover:bg-surface-hover hover:border-line-focus shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Download / Print Invoice
          </Link>
        </div>
      </div>

      {/* Visual Milestone Tracker */}
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-6">
          Order Status & Progress
        </h2>

        <div className="relative">
          {/* Progress bar background line */}
          <div className="absolute top-4 left-6 right-6 hidden h-1 bg-surface-muted sm:block">
            <div
              className="h-1 bg-primary-600 transition-all duration-500"
              style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
            {steps.map((step, idx) => {
              const isPast = idx < currentStep;
              const isCurrent = idx === currentStep;
              const isFuture = idx > currentStep;

              return (
                <div key={step.title} className="relative flex flex-row items-center gap-3 sm:flex-col sm:text-center">
                  <div
                    className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                      isPast
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : isCurrent
                        ? "border-primary-600 bg-surface text-primary-600 ring-4 ring-primary-100"
                        : "border-line bg-surface-muted text-ink-faint"
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                  </div>
                  <div className="sm:mt-2">
                    <p
                      className={`text-xs font-bold ${
                        isCurrent
                          ? "text-primary-700"
                          : isPast
                          ? "text-ink"
                          : "text-ink-muted"
                      }`}
                    >
                      {step.title}
                    </p>
                    <p className="text-[11px] text-ink-faint mt-0.5">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Grid: Items + Financial / Schedule */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Items Table (2 cols) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Items Sheet */}
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
            <h3 className="text-sm font-bold text-ink mb-4">
              Items & Specifications
            </h3>

            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-surface-muted/60 font-semibold text-ink">
                  <tr>
                    <th className="w-10 px-3.5 py-3 text-center">#</th>
                    <th className="px-3.5 py-3">Item / Product</th>
                    <th className="w-20 px-3.5 py-3 text-right">Qty</th>
                    <th className="w-24 px-3.5 py-3 text-right">Rate</th>
                    <th className="w-28 px-3.5 py-3 text-right">Amount ({currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item: OrderItemDetail, idx: number) => {
                      const qty = parseFloat(item.qty) || 0;
                      const rate = parseFloat(item.rate) || 0;
                      const amount = item.amount != null ? parseFloat(item.amount) : qty * rate;

                      return (
                        <tr key={item.id || idx} className="hover:bg-surface-hover/50">
                          <td className="px-3.5 py-3 text-center font-mono text-ink-muted">
                            {idx + 1}
                          </td>
                          <td className="px-3.5 py-3">
                            <span className="font-semibold text-ink">
                              {item.product_name || "Custom Print Product"}
                            </span>
                            {item.description && (
                              <p className="mt-0.5 whitespace-pre-wrap text-[11px] leading-relaxed text-ink-muted">
                                {item.description}
                              </p>
                            )}
                            {item.extra_data && Object.keys(item.extra_data).length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {Object.entries(item.extra_data).map(([k, v]) => {
                                  if (!v) return null;
                                  return (
                                    <span
                                      key={k}
                                      className="inline-flex rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-ink-muted"
                                    >
                                      <span className="capitalize">{k.replace(/_/g, " ")}</span>:{" "}
                                      <span className="ml-1 font-semibold text-ink">{v}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="tnum px-3.5 py-3 text-right font-mono text-ink">
                            {item.qty || "1"}
                          </td>
                          <td className="tnum px-3.5 py-3 text-right font-mono text-ink">
                            {formatCurrency(rate, currency)}
                          </td>
                          <td className="tnum px-3.5 py-3 text-right font-mono font-bold text-ink">
                            {formatCurrency(amount, currency)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-ink-faint">
                        No item details recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Project Notes if present */}
            {order.description && (
              <div className="mt-4 rounded-xl border border-line bg-surface-muted/30 p-3.5 text-xs">
                <span className="font-bold text-ink">Project Description / Notes: </span>
                <span className="text-ink-muted leading-relaxed whitespace-pre-wrap">
                  {order.description}
                </span>
              </div>
            )}
          </div>

          {/* Artwork Proof Gallery */}
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary-600" />
                <h3 className="text-sm font-bold text-ink">
                  Artwork & Production Proofs ({images.length})
                </h3>
              </div>
              {images.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setLightboxIndex(0);
                    setLightboxOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View All Fullscreen
                </button>
              )}
            </div>

            {images.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {images.map((img, idx) => (
                  <div
                    key={img.id || idx}
                    onClick={() => {
                      setLightboxIndex(idx);
                      setLightboxOpen(true);
                    }}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-line bg-surface-muted aspect-square transition hover:border-line-focus shadow-xs"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.image}
                      alt={img.caption || `Proof #${idx + 1}`}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                      <Maximize2 className="h-5 w-5 text-white drop-shadow-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-line p-8 text-center">
                <ImageIcon className="mx-auto h-8 w-8 text-ink-faint" />
                <p className="mt-2 text-xs font-medium text-ink-muted">
                  No proofs or photos uploaded yet.
                </p>
                <p className="text-[11px] text-ink-faint mt-0.5">
                  Production photos and artwork proofs will appear here as soon as uploaded by our design team.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Financials & Delivery (1 col) */}
        <div className="space-y-6">
          {/* Financial Breakdown */}
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-4">
              Billing & Balance Due
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-ink-muted">
                <span>Subtotal</span>
                <span className="font-mono font-semibold text-ink">
                  {formatCurrency(order.subtotal || 0, currency)}
                </span>
              </div>

              {parseFloat(order.tax_amount || "0") > 0 && (
                <div className="flex items-center justify-between text-ink-muted">
                  <span>GST ({order.tax_percent}%)</span>
                  <span className="font-mono font-semibold text-ink">
                    {formatCurrency(order.tax_amount || 0, currency)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-line pt-2 text-sm font-bold text-ink">
                <span>Total Amount</span>
                <span className="font-mono text-base font-extrabold text-ink">
                  {formatCurrency(grandTotalNum, currency)}
                </span>
              </div>

              <div className="flex items-center justify-between text-emerald-700">
                <span>Amount Paid</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(paidAmountNum, currency)}
                </span>
              </div>

              {/* Outstanding Balance Highlight Card */}
              <div
                className={`mt-3 rounded-xl border p-4 ${
                  dueAmountNum > 0
                    ? "border-rose-200 bg-rose-50/70"
                    : "border-emerald-200 bg-emerald-50/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      dueAmountNum > 0 ? "text-rose-800" : "text-emerald-800"
                    }`}
                  >
                    Balance Due
                  </span>
                  <span
                    className={`font-mono text-lg font-black ${
                      dueAmountNum > 0 ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {formatCurrency(dueAmountNum, currency)}
                  </span>
                </div>
                {dueAmountNum > 0 && (
                  <p className="mt-1 text-[11px] text-rose-800 leading-tight">
                    Payment is pending. Please contact our accounting desk for wire transfer / UPI details.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Delivery & Schedule Info */}
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-4">
              Schedule & Logistics
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-start gap-2.5">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                <div>
                  <p className="font-semibold text-ink">Expected Delivery Date</p>
                  <p className="text-ink-muted mt-0.5">
                    {order.delivery_time ? order.delivery_time : "To be confirmed by production manager"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                <div>
                  <p className="font-semibold text-ink">Client Account</p>
                  <p className="text-ink-muted mt-0.5">
                    {order.client_name}
                    {order.company_name && <> · {order.company_name}</>}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox for Artwork Proofs */}
      {lightboxOpen && (
        <ImageLightboxModal
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          images={images}
          initialIndex={lightboxIndex}
        />
      )}
    </div>
  );
}
