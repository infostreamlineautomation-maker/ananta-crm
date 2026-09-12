"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Image as ImageIcon, Loader2, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { AppSettings, Client, OrderSummary, ProjectSummary } from "@/lib/types";
import { formatCurrency, mediaUrl, getBrandLogo } from "@/lib/format";
import { Button } from "@/components/ui/Button";

interface ProjectDetail extends ProjectSummary {
  client_id?: number;
  created_at?: string;
}

function formatPrintDate(iso?: string | null): string {
  if (!iso) return "—";
  const parts = iso.split("T")[0].split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
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
  const [useBackground, setUseBackground] = useState(true);

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
  const designation = settings?.quotation_designation || "Proprietor";
  const bgImage = settings?.quotation_background_image ? mediaUrl(settings.quotation_background_image) : null;
  const logoImage = getBrandLogo(companyName, settings?.logo || settings?.app_logo);
  const signatureImage = settings?.quotation_signature_image ? mediaUrl(settings.quotation_signature_image) : null;
  const hasBackground = Boolean(bgImage && useBackground);

  const totalBilled = orders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
  const totalPaid = orders.filter((o) => o.payment_status === "paid").reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
  const balanceDue = totalBilled - totalPaid;

  const clientDisplayName = client?.company_name || project.client_name || "";
  const clientAddress = client?.address || "";

  return (
    <div className="min-h-screen bg-neutral-200 py-8 text-black print:bg-white print:py-0">
      {/* Global Print Styles matching exact A4 dimensions & color rendering */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          html,
          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Top Action Bar (Hidden on print) */}
      <div className="mx-auto mb-5 flex max-w-[820px] items-center justify-between px-4 print:hidden">
        <Link
          href={`/projects/${project.id}`}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Project
        </Link>
        <div className="flex items-center gap-2.5">
          {bgImage && (
            <button
              type="button"
              onClick={() => setUseBackground(!useBackground)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-xs hover:bg-neutral-50 cursor-pointer"
            >
              {useBackground ? <ImageIcon className="h-3.5 w-3.5 text-primary-600" /> : <FileText className="h-3.5 w-3.5 text-ink-muted" />}
              Letterhead Pad: <span className="font-bold">{useBackground ? "ON" : "OFF"}</span>
            </button>
          )}
          <Button variant="primary" onClick={() => window.print()} className="gap-2 shadow-sm">
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="mx-auto max-w-[820px] pb-16 print:max-w-none print:pb-0">
        <div
          className="relative mx-auto bg-white shadow-xl print:shadow-none border border-neutral-300 print:border-0 overflow-hidden text-black font-sans leading-normal"
          style={{
            width: "100%",
            minHeight: "1120px",
            boxSizing: "border-box",
            backgroundImage: hasBackground ? `url(${bgImage})` : undefined,
            backgroundSize: "100% 100%",
            backgroundPosition: "top center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* Digital Fallback Header (Only displayed if no background letterpad) */}
          {!hasBackground && (
            <div className="border-b-2 border-primary-600 px-10 pt-8 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoImage} alt={companyName} className="h-14 w-auto object-contain" />
                <div>
                  <h1 className="text-xl font-black text-black tracking-tight">{companyName}</h1>
                  {settings?.tagline && <p className="text-xs font-semibold text-primary-700">{settings.tagline}</p>}
                  {settings?.company_address && <p className="text-[11.5px] text-neutral-600 mt-0.5 max-w-sm">{settings.company_address}</p>}
                </div>
              </div>
              <div className="text-right text-xs text-neutral-600">
                {settings?.company_phone && <p>Tel: {settings.company_phone}</p>}
                {settings?.company_email && <p>Email: {settings.company_email}</p>}
              </div>
            </div>
          )}

          {/* Main Printable Content Container */}
          <div
            className={`flex flex-col justify-between ${
              hasBackground ? "pt-[160px] px-12 pb-[115px]" : "px-10 py-6"
            }`}
            style={{ minHeight: hasBackground ? "1120px" : "auto" }}
          >
            <div>
              {/* Row 1: Client details & Statement No / Date */}
              <div className="flex items-start justify-between gap-6 text-[13.5px]">
                {/* Left: To Client */}
                <div className="max-w-[420px]">
                  <p className="font-semibold text-black">To,</p>
                  {clientDisplayName && (
                    <p className="mt-0.5 font-black text-[14.5px] uppercase tracking-wide text-black">
                      {clientDisplayName}
                    </p>
                  )}
                  {clientAddress && (
                    <div className="mt-0.5 whitespace-pre-line text-[13px] font-medium leading-snug text-neutral-900">
                      {clientAddress}
                    </div>
                  )}
                </div>

                {/* Right: Statement & Date */}
                <div className="text-right whitespace-nowrap text-[13.5px]">
                  <p className="font-bold text-black">
                    Project : <span className="font-black">{project.name}</span>
                  </p>
                  <p className="mt-1 font-bold text-black">
                    Date : <span className="font-black">{formatPrintDate(new Date().toISOString())}</span>
                  </p>
                </div>
              </div>

              {/* Row 2: Subject / Heading */}
              <div className="mt-6 text-center">
                <h2 className="inline-block border-b-2 border-black pb-0.5 text-[13.5px] font-black tracking-wide text-black uppercase">
                  SUB. : PROJECT BILLING STATEMENT
                </h2>
              </div>

              {/* Row 3: Scope / Description if any */}
              {project.description && (
                <div className="mt-5 text-[13px] font-medium leading-relaxed text-black text-justify">
                  <p>{project.description}</p>
                </div>
              )}

              {/* Row 4: Associated Orders Table */}
              <div className="mt-5">
                <table className="w-full border-collapse border-2 border-black text-[13px]">
                  <thead>
                    <tr className="border-b-2 border-black text-[12px] font-bold uppercase tracking-wider text-black">
                      <th className="border-r border-black w-14 px-2 py-2 text-center">
                        SR. NO.
                      </th>
                      <th className="border-r border-black px-3 py-2 text-left">
                        ORDER NO / DELIVERABLE
                      </th>
                      <th className="border-r border-black w-28 px-2 py-2 text-center">
                        DATE
                      </th>
                      <th className="border-r border-black w-28 px-2 py-2 text-center">
                        STATUS
                      </th>
                      <th className="w-36 px-3 py-2 text-right">
                        AMOUNT ({baseCurr})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr className="border-b border-black">
                        <td colSpan={5} className="px-3 py-4 text-center text-xs font-medium text-neutral-600">
                          No orders linked to this project yet.
                        </td>
                      </tr>
                    ) : (
                      orders.map((o, idx) => (
                        <tr key={o.id} className="border-b border-black last:border-b-0">
                          <td className="border-r border-black px-2 py-2.5 text-center font-medium">
                            {idx + 1}
                          </td>
                          <td className="border-r border-black px-3 py-2.5 text-left font-medium">
                            <span className="font-bold">{o.order_no}</span>
                            {o.delivery_status && (
                              <span className="ml-2 text-xs text-neutral-700 capitalize">
                                ({o.delivery_status.replace("_", " ")})
                              </span>
                            )}
                          </td>
                          <td className="border-r border-black px-2 py-2.5 text-center font-medium">
                            {formatPrintDate(o.date)}
                          </td>
                          <td className="border-r border-black px-2 py-2.5 text-center font-bold text-xs uppercase">
                            {o.payment_status}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold tnum">
                            {formatCurrency(o.grand_total, o.currency_code || baseCurr)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Row 5: Financial Totals & Terms */}
              <div className="mt-5 flex flex-col sm:flex-row items-start justify-between gap-6">
                <div className="max-w-[420px] text-[12.5px] leading-normal text-black">
                  {settings?.quotation_terms && (
                    <>
                      <p className="font-bold underline uppercase tracking-wide">TERMS &amp; CONDITIONS :</p>
                      <p className="mt-1.5 whitespace-pre-line text-neutral-900">{settings.quotation_terms}</p>
                    </>
                  )}
                </div>

                <div className="w-full sm:w-72 border-2 border-black text-[13px]">
                  <div className="flex justify-between px-3 py-1.5 border-b border-black font-semibold">
                    <span>Total Billed :</span>
                    <span className="tnum font-bold">{formatCurrency(totalBilled, baseCurr)}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5 border-b border-black font-semibold">
                    <span>Total Received :</span>
                    <span className="tnum font-bold text-emerald-800">{formatCurrency(totalPaid, baseCurr)}</span>
                  </div>
                  <div className="flex justify-between px-3 py-2 bg-neutral-100 font-black text-[14px]">
                    <span>Balance Due :</span>
                    <span className={`tnum ${balanceDue > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                      {formatCurrency(balanceDue, baseCurr)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 6: Sign-off / Signature Block (Left Aligned / matching quotation) */}
            <div className="mt-8 text-left text-[13.5px] text-black">
              <p className="font-semibold">Thank you,</p>
              <div className="my-1.5 h-12 flex items-center">
                {signatureImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signatureImage} alt="Signature" className="max-h-12 max-w-[160px] object-contain" />
                ) : (
                  <div className="h-8" />
                )}
              </div>
              <p className="font-black text-[14px] text-black tracking-wide">{companyName}</p>
              <p className="text-[12.5px] font-medium text-neutral-800">{designation}</p>
            </div>
          </div>

          {/* Digital Fallback Footer (Only displayed if no background letterpad) */}
          {!hasBackground && (
            <div className="border-t-2 border-primary-600 bg-neutral-50 px-10 py-3 text-center text-[11px] font-semibold text-neutral-700">
              <p className="tracking-widest uppercase text-primary-700 font-bold mb-0.5">
                Designing &nbsp;|&nbsp; Printing &nbsp;|&nbsp; Advertising &nbsp;|&nbsp; Branding &nbsp;|&nbsp; Packaging Solutions
              </p>
              <p className="text-neutral-500 text-[10.5px]">
                {[settings?.company_address, settings?.company_phone, settings?.company_email].filter(Boolean).join(" • ")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
