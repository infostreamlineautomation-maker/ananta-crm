"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { AppSettings, QuotationDetail } from "@/lib/types";
import { formatCurrency, formatDate, mediaUrl } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

export default function QuotationPrintPage() {
  const params = useParams<{ id: string }>();
  const quotationId = Number(params.id);
  const router = useRouter();
  const toast = useToast();
  const { user, loading: authLoading, can } = useAuth();

  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    Promise.all([apiFetch<QuotationDetail>(`/api/quotations/${quotationId}/`), apiFetch<AppSettings>("/api/settings/")])
      .then(([q, s]) => {
        setQuotation(q);
        setSettings(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [quotationId]);

  async function handleCreateOrder() {
    if (!quotation) return;
    setCreatingOrder(true);
    try {
      const order = await apiFetch<{ id: number; order_no: string }>(`/api/quotations/${quotation.id}/create-order/`, {
        method: "POST",
        body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), tax_percent: 0 }),
      });
      toast.success(`Order ${order.order_no} created.`);
      router.push(`/orders/${order.id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't create an order from this quotation.");
    } finally {
      setCreatingOrder(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <p className="text-sm text-ink-faint">Quotation not found.</p>
      </div>
    );
  }

  const currency = quotation.currency_code || "INR";
  const columns = quotation.columns_config;
  const bgImage = settings?.quotation_background_image ? mediaUrl(settings.quotation_background_image) : null;
  const logoImage = settings?.logo ? mediaUrl(settings.logo) : settings?.app_logo ? mediaUrl(settings.app_logo) : null;

  return (
    <div className="min-h-screen bg-neutral-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto flex max-w-[840px] items-center justify-between px-4 py-4 print:hidden">
        <Link
          href={`/quotations/${quotation.id}`}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Quotation
        </Link>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => window.print()} className="gap-2 shadow-sm">
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </Button>
          {can("orders", "add") && (
            <Button variant="secondary" onClick={handleCreateOrder} loading={creatingOrder}>
              Create Order from this Quotation
            </Button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[840px] pb-16 print:max-w-none print:pb-0">
        <div
          className="relative bg-white p-10 shadow-lg print:shadow-none rounded-xl print:rounded-none border border-border print:border-0 overflow-hidden"
          style={{
            backgroundImage: bgImage ? `url(${bgImage})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* Letterhead */}
          <div className="flex items-start justify-between border-b-2 border-primary-500 pb-6 relative z-10">
            <div>
              {logoImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoImage} alt="" className="mb-2 h-12 max-w-[200px] object-contain" />
              )}
              <p className="text-lg font-black text-ink">{settings?.company_name || settings?.name || settings?.app_name || "Ananta Graphics"}</p>
              {settings?.tagline && <p className="text-xs font-semibold text-primary-600 mb-1">{settings.tagline}</p>}
              {settings?.company_address && <p className="max-w-xs text-[12px] whitespace-pre-line text-ink-muted">{settings.company_address}</p>}
              <p className="text-[12px] text-ink-muted">
                {[settings?.company_email, settings?.company_phone].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="text-right">
              <div className="inline-block rounded-lg bg-primary-50 px-3 py-1.5 text-right border border-primary-100">
                <span className="text-[11px] font-black uppercase tracking-widest text-primary-700">Official Quotation</span>
                <p className="mt-0.5 font-mono text-base font-black text-ink">{quotation.quotation_no}</p>
              </div>
              <p className="mt-2 text-[12px] text-ink-muted">Date: <strong className="text-ink font-semibold">{formatDate(quotation.quotation_date)}</strong></p>
            </div>
          </div>

          {/* To */}
          <div className="mt-6">
            <p className="text-[11px] font-bold tracking-wider text-ink-faint uppercase">To</p>
            <p className="mt-1 text-[13.5px] font-semibold text-ink">{quotation.to_name || quotation.client_name || "—"}</p>
            {quotation.to_address && <p className="max-w-md text-[13px] whitespace-pre-line text-ink-muted">{quotation.to_address}</p>}
            {quotation.subject && <p className="mt-2 text-[13.5px]"><span className="font-semibold text-ink">Subject: </span><span className="text-ink-muted">{quotation.subject}</span></p>}
          </div>

          {quotation.intro_text && <p className="mt-5 text-[13.5px] whitespace-pre-line text-ink-muted">{quotation.intro_text}</p>}

          {/* Items */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-[11px] font-bold tracking-wider text-ink-faint uppercase">
                  <th className="px-3 py-2 text-left">Description</th>
                  {columns.map((col) => (
                    <th key={col.key} className="px-3 py-2 text-left">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">{quotation.col_qty_label}</th>
                  <th className="px-3 py-2 text-right">{quotation.col_rate_label}</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((it, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-3 py-2.5 text-[13px] text-ink">{it.description}</td>
                    {columns.map((col) => (
                      <td key={col.key} className="px-3 py-2.5 text-[13px] text-ink-muted">
                        {it.extra_data[col.key] ?? ""}
                      </td>
                    ))}
                    <td className="tnum px-3 py-2.5 text-right text-[13px] text-ink">{it.qty}</td>
                    <td className="tnum px-3 py-2.5 text-right text-[13px] text-ink">{formatCurrency(it.rate, currency)}</td>
                    <td className="tnum px-3 py-2.5 text-right text-[13px] font-semibold text-ink">{formatCurrency(it.amount ?? "0", currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-primary-50">
                  <td colSpan={2 + columns.length} className="px-3 py-3 text-right text-[13px] font-bold text-ink">
                    Subtotal
                  </td>
                  <td colSpan={2} className="tnum px-3 py-3 text-right text-base font-extrabold text-primary-600">
                    {formatCurrency(quotation.subtotal, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {quotation.notes && (
            <div className="mt-6">
              <p className="text-[11px] font-bold tracking-wider text-ink-faint uppercase">Notes</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-[13px] text-ink-muted">
                {quotation.notes.split("\n").filter(Boolean).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Footer */}
          <div className="mt-10 flex items-end justify-between border-t border-border pt-6">
            <div className="max-w-xs text-[11px] text-ink-faint whitespace-pre-line">
              {quotation.footer_content || settings?.quotation_terms}
            </div>
            <div className="text-right">
              {settings?.quotation_signature_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.quotation_signature_image} alt="" className="ml-auto mb-1 h-12 object-contain" />
              )}
              <p className="text-[13px] font-semibold text-ink">{settings?.quotation_signature_name}</p>
              <p className="text-[12px] text-ink-muted">{settings?.quotation_designation}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
