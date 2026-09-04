"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FolderKanban, Loader2, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { AppSettings, Client, OrderSummary, ProjectSummary } from "@/lib/types";
import { formatCurrency, formatDate, mediaUrl, getBrandLogo } from "@/lib/format";
import { Button } from "@/components/ui/Button";

interface ProjectDetail extends ProjectSummary {
  client_id?: number;
  created_at?: string;
}

export default function ProjectPrintPage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    Promise.all([
      apiFetch<ProjectDetail>(`/api/projects/${projectId}/`),
      apiFetch<OrderSummary[]>(`/api/orders/?project=${projectId}`),
      apiFetch<AppSettings>("/api/settings/"),
    ])
      .then(async ([proj, ords, s]) => {
        setProject(proj);
        setOrders(ords);
        setSettings(s);
        if (proj.client_id) {
          try {
            const cl = await apiFetch<Client>(`/api/clients/${proj.client_id}/`);
            setClient(cl);
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <p className="text-sm text-ink-faint">Project not found.</p>
      </div>
    );
  }

  const baseCurr = settings?.default_currency_code || "INR";
  const companyName = settings?.company_name || settings?.name || settings?.app_name || "Ananta Graphics";
  const bgImage = settings?.quotation_background_image ? mediaUrl(settings.quotation_background_image) : null;
  const logoImage = getBrandLogo(companyName, settings?.logo || settings?.app_logo);
  const signatureImage = settings?.quotation_signature_image ? mediaUrl(settings.quotation_signature_image) : null;

  const totalBilled = orders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
  const totalPaid = orders.filter((o) => o.payment_status === "paid").reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
  const balanceDue = totalBilled - totalPaid;

  return (
    <div className="min-h-screen bg-neutral-100 py-8 text-ink print:bg-white print:py-0">
      {/* Top Action Bar (Hidden on print) */}
      <div className="mx-auto mb-6 flex max-w-4xl items-center justify-between px-4 print:hidden">
        <Link
          href={`/projects/${project.id}`}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Project
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => window.print()} className="gap-2 shadow-sm">
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div
        className="relative mx-auto max-w-4xl rounded-xl border border-border bg-white shadow-lg print:border-0 print:shadow-none print:max-w-none print:rounded-none overflow-hidden"
        style={{
          backgroundImage: bgImage ? `url(${bgImage})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
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

            <div className="sm:text-right">
              <div className="inline-block rounded-lg bg-purple-50 px-3.5 py-1.5 text-right border border-purple-100">
                <span className="text-[11px] font-black uppercase tracking-widest text-purple-700">Project Billing Statement</span>
                <p className="font-mono text-lg font-black text-ink">{project.name}</p>
              </div>
              <div className="mt-3 text-xs space-y-1">
                <p className="text-ink-muted">
                  Statement Date: <strong className="font-mono text-ink font-semibold">{formatDate(new Date().toISOString())}</strong>
                </p>
                <p className="text-ink-muted">
                  Project Status: <strong className="text-ink font-semibold uppercase">{project.status}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Project & Client Details */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 rounded-lg bg-surface-sunken/40 p-4 border border-border/60">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Client Information</p>
              <h3 className="mt-1 text-base font-bold text-ink">{project.client_name}</h3>
              {client?.company_name && <p className="text-xs font-semibold text-ink-muted">{client.company_name}</p>}
              {client?.address && <p className="text-xs text-ink-muted mt-1 whitespace-pre-line">{client.address}</p>}
              {client?.country_name && <p className="text-xs text-ink-muted">{client.country_name}</p>}
            </div>

            <div className="sm:text-right text-xs space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Project Scope & Summary</p>
              <p className="text-ink-muted">{project.description || "No specific project description provided."}</p>
              <div className="pt-2 border-t border-border/40 mt-2 flex sm:justify-end gap-3 text-xs">
                <span>Total Orders: <strong className="font-mono text-ink font-bold">{orders.length}</strong></span>
                <span>Quotations: <strong className="font-mono text-ink font-bold">{project.quotations_count || 0}</strong></span>
              </div>
            </div>
          </div>

          {/* Associated Orders Table */}
          <div className="mt-8 overflow-hidden rounded-lg border border-border">
            <div className="bg-surface-sunken/80 px-4 py-2.5 border-b border-border flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-ink">Associated Orders & Deliverables</span>
              <span className="text-xs text-ink-muted">{orders.length} orders billed</span>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11.5px] font-bold uppercase tracking-wider text-ink-faint bg-surface-sunken/30">
                  <th className="px-4 py-2.5">Order No</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Fulfillment</th>
                  <th className="px-4 py-2.5">Payment</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-xs text-ink-faint">
                      No orders linked to this project yet.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="hover:bg-surface-hover/30">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-ink">{o.order_no}</td>
                      <td className="px-4 py-3 text-xs text-ink-muted">{formatDate(o.date)}</td>
                      <td className="px-4 py-3 text-xs capitalize text-ink-muted">{o.delivery_status.replace("_", " ")}</td>
                      <td className="px-4 py-3 text-xs">
                        <span
                          className={`font-semibold capitalize ${
                            o.payment_status === "paid"
                              ? "text-emerald-600"
                              : o.payment_status === "partial"
                              ? "text-amber-600"
                              : "text-rose-600"
                          }`}
                        >
                          {o.payment_status}
                        </span>
                      </td>
                      <td className="tnum px-4 py-3 text-right text-xs font-bold text-ink font-mono">
                        {formatCurrency(o.grand_total, o.currency_code || baseCurr)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Statement Financial Summary */}
          <div className="mt-6 flex flex-col sm:flex-row items-start justify-between gap-6">
            <div className="max-w-md text-xs text-ink-muted">
              {settings?.quotation_terms && (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1">Project Terms</p>
                  <p className="whitespace-pre-line">{settings.quotation_terms}</p>
                </>
              )}
            </div>

            <div className="w-full sm:w-80 rounded-lg bg-surface-sunken/40 p-4 border border-border/80 space-y-2 text-xs">
              <div className="flex justify-between text-ink-muted">
                <span>Total Project Billed:</span>
                <span className="font-mono font-bold text-ink">{formatCurrency(totalBilled, baseCurr)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Total Paid Collections:</span>
                <span className="font-mono font-bold">{formatCurrency(totalPaid, baseCurr)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-sm font-bold text-ink">
                <span>Outstanding Balance Due:</span>
                <span className={`font-mono text-base font-black ${balanceDue > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {formatCurrency(balanceDue, baseCurr)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Signature */}
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
