"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, Loader2, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { AppSettings, Client, OrderDetail } from "@/lib/types";
import { formatCurrency, formatDate, mediaUrl, getBrandLogo } from "@/lib/format";
import { Button } from "@/components/ui/Button";

export default function OrderPrintPage() {
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    Promise.all([
      apiFetch<OrderDetail>(`/api/orders/${orderId}/`),
      apiFetch<AppSettings>("/api/settings/"),
    ])
      .then(async ([ord, s]) => {
        setOrder(ord);
        setSettings(s);
        if (ord.client) {
          try {
            const cl = await apiFetch<Client>(`/api/clients/${ord.client}/`);
            setClient(cl);
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <p className="text-sm text-ink-faint">Order not found.</p>
      </div>
    );
  }

  const currency = order.currency_code || settings?.default_currency_code || "INR";
  const orgBaseCurr = settings?.default_currency_code || "INR";
  const companyName = settings?.company_name || settings?.name || settings?.app_name || "Ananta Graphics";
  const bgImage = settings?.quotation_background_image ? mediaUrl(settings.quotation_background_image) : null;
  const logoImage = getBrandLogo(companyName, settings?.logo || settings?.app_logo);
  const signatureImage = settings?.quotation_signature_image ? mediaUrl(settings.quotation_signature_image) : null;

  return (
    <div className="min-h-screen bg-neutral-100 py-8 text-ink print:bg-white print:py-0">
      {/* Top Action Bar (Hidden on print) */}
      <div className="mx-auto mb-6 flex max-w-4xl items-center justify-between px-4 print:hidden">
        <Link
          href={`/orders/${order.id}`}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Order
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => window.print()} className="gap-2 shadow-sm">
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* Invoice Sheet */}
      <div
        className="relative mx-auto max-w-4xl rounded-xl border border-border bg-white shadow-lg print:border-0 print:shadow-none print:max-w-none print:rounded-none overflow-hidden"
        style={{
          backgroundImage: bgImage ? `url(${bgImage})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Printable Content Padding */}
        <div className="p-8 sm:p-12 relative z-10">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 border-b border-border/80 pb-8">
            <div className="max-w-md">
              <div className="flex items-center gap-3.5 mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoImage} alt={companyName} className="h-14 w-14 rounded-full border border-border object-contain p-0.5 bg-white shadow-xs" />
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-ink">{companyName}</h1>
                  {settings?.tagline && <p className="text-xs font-semibold text-primary-600/80">{settings.tagline}</p>}
                </div>
              </div>
              <div className="text-xs text-ink-muted space-y-0.5 whitespace-pre-line">
                {settings?.company_address && <p>{settings.company_address}</p>}
                <div className="flex flex-wrap gap-x-4">
                  {settings?.company_phone && <p>Tel: {settings.company_phone}</p>}
                  {settings?.company_email && <p>Email: {settings.company_email}</p>}
                </div>
              </div>
            </div>

            {/* Document Title & Reference */}
            <div className="sm:text-right">
              <div className="inline-block rounded-lg bg-primary-50 px-3.5 py-1.5 text-right border border-primary-100">
                <span className="text-[11px] font-black uppercase tracking-widest text-primary-700">Tax Invoice / Bill</span>
                <p className="font-mono text-xl font-black text-ink">{order.order_no}</p>
              </div>
              <div className="mt-3 text-xs space-y-1">
                <p className="text-ink-muted">
                  Date: <strong className="font-mono text-ink font-semibold">{formatDate(order.date)}</strong>
                </p>
                {order.project_name && (
                  <p className="text-ink-muted">
                    Project: <strong className="text-ink font-semibold">{order.project_name}</strong>
                  </p>
                )}
                <div className="flex items-center sm:justify-end gap-2 pt-1">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                      order.payment_status === "paid"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : order.payment_status === "partial"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    {order.payment_status === "paid" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    Payment: {order.payment_status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Billed To Details */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 rounded-lg bg-surface-sunken/40 p-4 border border-border/60">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Billed To (Client)</p>
              <h3 className="mt-1 text-base font-bold text-ink">{order.client_name}</h3>
              {client?.company_name && <p className="text-xs font-semibold text-ink-muted">{client.company_name}</p>}
              {client?.address && <p className="text-xs text-ink-muted mt-1 whitespace-pre-line">{client.address}</p>}
              {client?.country_name && <p className="text-xs text-ink-muted">{client.country_name}</p>}
            </div>

            <div className="sm:text-right text-xs space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Client Contact</p>
              {client?.phone && <p className="text-ink-muted">Phone: <strong className="text-ink">{client.phone}</strong></p>}
              {client?.email && <p className="text-ink-muted">Email: <strong className="text-ink">{client.email}</strong></p>}
              {order.description && (
                <div className="mt-2 pt-2 border-t border-border/40 text-left sm:text-right">
                  <p className="text-[11px] font-bold text-ink-faint uppercase">Order Remarks</p>
                  <p className="text-ink-muted italic">{order.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mt-8 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-sunken/80 text-[11.5px] font-bold uppercase tracking-wider text-ink">
                  <th className="px-4 py-3 w-12 text-center">#</th>
                  <th className="px-4 py-3">Item & Description</th>
                  {(order.columns_config || []).map((col) => (
                    <th key={col.key} className="px-4 py-3 text-left">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Rate ({currency})</th>
                  <th className="px-4 py-3 text-right">Amount ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {order.items.map((it, idx) => (
                  <tr key={it.id || idx} className="hover:bg-surface-hover/30">
                    <td className="px-4 py-3 text-center text-xs text-ink-muted font-mono">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-ink">{it.product_name || "Custom Item"}</p>
                      {it.description && <p className="text-xs text-ink-muted mt-0.5 whitespace-pre-line">{it.description}</p>}
                    </td>
                    {(order.columns_config || []).map((col) => (
                      <td key={col.key} className="px-4 py-3 text-xs text-ink-muted">
                        {it.extra_data?.[col.key] ?? "-"}
                      </td>
                    ))}
                    <td className="tnum px-4 py-3 text-right text-xs font-semibold text-ink font-mono">{it.qty}</td>
                    <td className="tnum px-4 py-3 text-right text-xs text-ink-muted font-mono">{formatCurrency(it.rate, currency)}</td>
                    <td className="tnum px-4 py-3 text-right text-xs font-bold text-ink font-mono">{formatCurrency(it.amount || "0", currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>


          {/* Totals Breakdown */}
          <div className="mt-6 flex flex-col sm:flex-row items-start justify-between gap-6">
            <div className="max-w-md text-xs text-ink-muted">
              {settings?.quotation_terms && (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1">Terms & Conditions</p>
                  <p className="whitespace-pre-line">{settings.quotation_terms}</p>
                </>
              )}
            </div>

            <div className="w-full sm:w-80 rounded-lg bg-surface-sunken/40 p-4 border border-border/80 space-y-2 text-xs">
              <div className="flex justify-between text-ink-muted">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-ink">{formatCurrency(order.subtotal, currency)}</span>
              </div>
              {Number(order.tax_percent) > 0 && (
                <div className="flex justify-between text-ink-muted">
                  <span>Tax ({order.tax_percent}%):</span>
                  <span className="font-mono font-semibold text-ink">{formatCurrency(order.tax_amount, currency)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between text-sm font-bold text-ink">
                <span>Total Amount:</span>
                <span className="font-mono text-base font-black text-ink">{formatCurrency(order.grand_total, currency)}</span>
              </div>
              {Number(order.paid_amount || 0) > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold pt-1 border-t border-border/50">
                  <span>Amount Paid / Received:</span>
                  <span className="font-mono">{formatCurrency(order.paid_amount || "0.00", currency)}</span>
                </div>
              )}
              <div className={`flex justify-between font-bold pt-1.5 border-t border-border ${Number(order.due_amount || (Number(order.grand_total) - Number(order.paid_amount || 0))) > 0 ? "text-rose-600 text-sm" : "text-emerald-700 text-xs"}`}>
                <span>Balance Due:</span>
                <span className="font-mono">
                  {formatCurrency(order.due_amount !== undefined ? order.due_amount : Math.max(0, Number(order.grand_total) - Number(order.paid_amount || 0)), currency)}
                </span>
              </div>
              {currency !== orgBaseCurr && order.exchange_rate && (
                <div className="pt-1 border-t border-border/40 text-[11px] text-ink-faint flex justify-between">
                  <span>In Base ({orgBaseCurr}):</span>
                  <span className="font-mono font-bold text-ink">
                    {formatCurrency(Number(order.grand_total) * Number(order.exchange_rate), orgBaseCurr)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer & Signature Block */}
          {(signatureImage || settings?.quotation_signature_name) && (
            <div className="mt-12 pt-8 border-t border-border/80 flex flex-col sm:flex-row items-end justify-between gap-6">
              <div className="text-[11px] text-ink-faint"></div>

              <div className="text-right">
                {signatureImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signatureImage} alt="Authorized Signature" className="ml-auto mb-1 h-12 object-contain" />
                )}
                <div className="w-48 border-t border-ink/40 pt-1">
                  {settings?.quotation_signature_name && (
                    <p className="text-[13px] font-bold text-ink">{settings.quotation_signature_name}</p>
                  )}
                  {settings?.quotation_designation && (
                    <p className="text-[11px] text-ink-muted">{settings.quotation_designation}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
