"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Image as ImageIcon, FileText, Loader2, Printer, ZoomIn, ZoomOut, Maximize2, Calculator, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { AppSettings, Client, QuotationAnnexure, QuotationDetail } from "@/lib/types";
import { formatCurrency, formatDate, mediaUrl, getBrandLogo, getReportLogo } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";

function formatQuotationDate(iso?: string | null): string {
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

export default function QuotationPrintPage() {
  const params = useParams<{ id: string }>();
  const quotationId = Number(params.id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user, loading: authLoading, can } = useAuth();

  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [clientData, setClientData] = useState<Client | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [useBackground, setUseBackground] = useState(true);
  const [annexures, setAnnexures] = useState<QuotationAnnexure[]>([]);
  const [useAnnexures, setUseAnnexures] = useState(true);
  const [showSubtotal, setShowSubtotal] = useState(true);
  const [showProfit, setShowProfit] = useState(false);
  const [printViewMode, setPrintViewMode] = useState<"standard" | "detailed">("standard");
  const [zoom, setZoom] = useState(1);
  const [lightboxImages, setLightboxImages] = useState<{ image: string; caption?: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  function handleZoomIn() {
    setZoom((z) => Math.min(1.6, Number((z + 0.1).toFixed(2))));
  }

  function handleZoomOut() {
    setZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(2))));
  }

  function handleResetZoom() {
    setZoom(1);
  }

  function handleFitWidth() {
    if (typeof window === "undefined") return;
    const available = window.innerWidth - 64;
    const calculated = Number((available / 820).toFixed(2));
    const target = Math.min(1.5, Math.max(0.75, calculated));
    setZoom(target);
  }

  useEffect(() => {
    const view = searchParams?.get("view");
    if (view === "detailed" || view === "standard") {
      setPrintViewMode(view);
    } else if (quotation?.quote_format === "detailed") {
      setPrintViewMode("detailed");
    } else {
      setPrintViewMode("standard");
    }
  }, [searchParams, quotation?.quote_format]);

  // Recipient details
  const toCompanyOrClient =
    quotation?.to_name ||
    clientData?.company_name ||
    quotation?.company_name ||
    clientData?.client_name ||
    quotation?.client_name ||
    "";
  const toAddress = quotation?.to_address || clientData?.address || quotation?.client_address || "";

  // Professional PDF Filename / Document Title
  const cleanQuoteNo = (quotation?.quotation_no || "Quote")
    .replace(/[\/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const cleanClient = (toCompanyOrClient || "")
    .replace(/[\/\\:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const pdfTitle =
    printViewMode === "detailed"
      ? cleanClient
        ? `Costing - ${cleanQuoteNo} - ${cleanClient}`
        : `Costing - ${cleanQuoteNo}`
      : cleanClient
      ? `Quotation - ${cleanQuoteNo} - ${cleanClient}`
      : `Quotation - ${cleanQuoteNo}`;

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!quotation) return;
    document.title = pdfTitle;
    return () => {
      document.title = "Ananta CRM";
    };
  }, [quotation, pdfTitle]);

  function handlePrint() {
    document.title = pdfTitle;
    window.print();
  }

  useEffect(() => {
    Promise.all([
      apiFetch<QuotationDetail>(`/api/quotations/${quotationId}/`),
      apiFetch<AppSettings>("/api/settings/"),
      apiFetch<{ annexures: QuotationAnnexure[] }>(`/api/quotations/${quotationId}/pdf-pages/`).catch(() => ({ annexures: [] })),
    ])
      .then(async ([q, s, annexureRes]) => {
        setQuotation(q);
        setSettings(s);
        if (q.col_labels?.show_subtotal !== undefined) {
          setShowSubtotal(String(q.col_labels.show_subtotal) === "true" || q.col_labels.show_subtotal === true);
        }
        if (q.col_labels?.show_profit !== undefined) {
          setShowProfit(String(q.col_labels.show_profit) === "true" || q.col_labels.show_profit === true);
        }
        if (annexureRes?.annexures) {
          setAnnexures(annexureRes.annexures);
        }
        if (q.client) {
          try {
            const cl = await apiFetch<Client>(`/api/clients/${q.client}/`);
            setClientData(cl);
          } catch {}
        }
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

  const columns = quotation.columns_config || [];
  const hasAnyItemImage = quotation.items?.some((it) => Boolean(it.image));
  const bgImage = settings?.quotation_background_image ? mediaUrl(settings.quotation_background_image) : null;
  const signatureImage = settings?.quotation_signature_image ? mediaUrl(settings.quotation_signature_image) : null;
  const companyName = settings?.company_name || settings?.name || settings?.app_name || "Ananta Graphics";
  const signatureName = settings?.quotation_signature_name || companyName;
  const isPvtLtd = companyName.toLowerCase().includes("ltd") || companyName.toLowerCase().includes("limited");
  const defaultDesignation = isPvtLtd ? "Director" : "Proprietor";
  const designation = settings?.quotation_designation || defaultDesignation;
  const contactPerson = settings?.quotation_contact_person || "";
  const logoImage = getReportLogo(companyName, settings?.report_logo, settings?.logo || settings?.app_logo);
  const currency = quotation.currency_code || clientData?.currency_code || settings?.default_currency_code || "INR";
  const computedSubtotal = (quotation.items || []).reduce((sum, it) => {
    const q = parseFloat(it.qty) || 0;
    const r = parseFloat(it.rate) || 0;
    return sum + q * r;
  }, 0);
  const subtotalValue = parseFloat(quotation.subtotal) || computedSubtotal;

  const computedTotalProfit = (quotation.items || []).reduce((sum, it) => {
    const q = parseFloat(it.qty) || 0;
    const r = parseFloat(it.rate) || 0;
    const sRate = parseFloat(it.supplier_rate ?? "0") || 0;
    const p = parseFloat(it.profit ?? "0") || (r > sRate && sRate > 0 ? r - sRate : 0);
    const tp = parseFloat(it.total_profit ?? "0") || q * p;
    return sum + tp;
  }, 0);
  const totalProfitValue = parseFloat(quotation.total_profit ?? "0") || computedTotalProfit;

  // Determine column titles as entered in the quotation form (whether costing or standard)
  const isCosting = quotation.quote_format === "costing";
  const colNameItem = quotation.col_labels?.item || "DESCRIPTION";
  const colNameReference = quotation.col_labels?.reference || "REFERENCE";
  const colNameQty = isCosting
    ? (quotation.col_labels?.supplier_qty || quotation.col_qty_label || quotation.col_labels?.qty || "QTY.")
    : (quotation.col_labels?.qty || quotation.col_qty_label || quotation.col_labels?.supplier_qty || "QTY.");
  const colNameRate = isCosting
    ? (quotation.col_labels?.client_rate || quotation.col_rate_label || quotation.col_labels?.rate || "RATE (PER PIECE)")
    : (quotation.col_labels?.rate || quotation.col_rate_label || quotation.col_labels?.client_rate || "RATE (PER PIECE)");
  const colNameAmount = quotation.col_labels?.amount || "AMOUNT";

  // Format Subject
  let formattedSubject = "";
  if (quotation.subject && quotation.subject.trim()) {
    const rawSub = quotation.subject.trim();
    if (rawSub.toUpperCase().startsWith("SUB")) {
      formattedSubject = rawSub.toUpperCase();
    } else if (rawSub.toUpperCase().startsWith("QUOTATION FOR")) {
      formattedSubject = `SUB. : ${rawSub.toUpperCase()}`;
    } else {
      formattedSubject = `SUB. : QUOTATION FOR ${rawSub.toUpperCase()}`;
    }
    if (!formattedSubject.endsWith(".")) {
      formattedSubject += ".";
    }
  } else {
    formattedSubject = "SUB. : QUOTATION.";
  }

  // Intro paragraph
  const DEFAULT_INTRO =
    "With The Above Reference, We Are Pleased To Supply The Material With The Following Rates As Per Terms & Conditions Stated Below. Please Sanction The Rates And Place The Order At The Earliest.";

  const isDefaultIntro =
    !quotation.intro_text ||
    quotation.intro_text.trim() === "" ||
    quotation.intro_text.includes("With The Above Reference");

  const intro =
    settings?.quotation_intro && settings.quotation_intro.trim()
      ? (isDefaultIntro ? settings.quotation_intro : (quotation.intro_text || settings.quotation_intro))
      : (quotation.intro_text || DEFAULT_INTRO);

  // Notes lines
  const DEFAULT_NOTES = `1. GST Should be Extra as per Government Rules.
2. Transportation charge will be extra as per the Location of Delivery.
3. Payment to be made by Payees A/c. Cheque, Draft or NEFT / RTGS / IMPS only.
4. Subject to Surat Jurisdiction.`;

  const isDefaultNotes =
    !quotation.notes ||
    quotation.notes.trim() === "" ||
    quotation.notes.includes("GST Should be Extra") ||
    quotation.notes.includes("Government Rules");

  const rawNotes =
    settings?.quotation_terms && settings.quotation_terms.trim()
      ? (isDefaultNotes ? settings.quotation_terms : (quotation.notes || settings.quotation_terms))
      : (quotation.notes || DEFAULT_NOTES);

  const notesLines = rawNotes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const hasBackground = Boolean(bgImage && useBackground);
  const isSinglePage = (quotation.items?.length || 0) <= 8;

  return (
    <div className="min-h-screen bg-neutral-200/90 pb-20 print:bg-white print:p-0 print:m-0 w-full overflow-x-hidden">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .quotation-sheet-root {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
            transform: none !important;
            margin-bottom: 0 !important;
          }
          .quotation-sheet {
            width: 210mm !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
            border: none !important;
            box-shadow: none !important;
            transform: none !important;
          }
          .quotation-sheet.is-single-page {
            height: 297mm !important;
            max-height: 297mm !important;
            min-height: 297mm !important;
            overflow: hidden !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .quotation-sheet.is-multi-page {
            min-height: 297mm !important;
            height: auto !important;
            background-repeat: repeat-y !important;
            background-size: 100% 297mm !important;
          }
          .quotation-sheet-content {
            box-sizing: border-box !important;
            min-height: 0 !important;
          }
          .signoff-box,
          .prevent-page-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            break-before: auto !important;
            display: inline-block !important;
            width: 100% !important;
          }
          table, tr, td, th {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .annexure-sheet {
            width: 210mm !important;
            height: 296mm !important;
            max-height: 296mm !important;
            min-height: 296mm !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            break-before: page !important;
            page-break-before: always !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* Top Action Bar (Sticky, full-width, perfectly organized 2-tier header) */}
      <header className="sticky top-0 z-30 mb-6 border-b border-neutral-300/80 bg-white shadow-xs print:hidden">
        {/* Row 1: Document Details & Primary Actions */}
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          {/* Left: Back Link & Document Meta */}
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href={`/quotations/${quotation.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-ink shadow-2xs hover:bg-neutral-50 hover:text-primary-700 hover:border-primary-300 transition-colors shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Quotation</span>
              <span className="sm:hidden">Back</span>
            </Link>

            <div className="h-4 w-px bg-neutral-200 hidden sm:block shrink-0" />

            {/* Quote Number & Client Title */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 text-xs font-bold text-neutral-800 shrink-0 font-mono">
                <FileText className="h-3 w-3 text-primary-600" />
                {quotation.quotation_no}
              </span>
              {toCompanyOrClient && (
                <span className="text-xs font-bold text-ink truncate max-w-[160px] sm:max-w-[280px] md:max-w-[420px]" title={toCompanyOrClient}>
                  {toCompanyOrClient}
                </span>
              )}
            </div>
          </div>

          {/* Right: Primary Print & Convert to Order */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white px-3.5 py-1.5 text-xs font-bold shadow-sm transition-colors cursor-pointer"
              title="Print or Save as PDF (Ctrl+P)"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save as PDF</span>
            </button>

            {can("orders", "add") && (
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={creatingOrder}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white hover:bg-neutral-50 text-ink px-3 py-1.5 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <span>{creatingOrder ? "Creating..." : "Create Order"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Secondary Controls Strip (View Format, PDF Toggles, Zoom) */}
        <div className="border-t border-neutral-200/80 bg-neutral-50/90 px-4 py-1.5 sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 flex-wrap">
            {/* Left: View Format Switcher (if detailed costing exists) & Filename */}
            <div className="flex items-center gap-2.5 shrink-0">
              {Boolean(quotation?.detailed_costing_data?.rows?.length) && (
                <div className="inline-flex items-center rounded-lg border border-border bg-white p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setPrintViewMode("standard")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                      printViewMode === "standard"
                        ? "bg-primary-50 text-primary-700 font-bold border border-primary-200 shadow-2xs"
                        : "text-neutral-600 hover:text-black"
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Standard Quotation</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintViewMode("detailed")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                      printViewMode === "detailed"
                        ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shadow-2xs"
                        : "text-neutral-600 hover:text-black"
                    }`}
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    <span>Detailed Costing</span>
                  </button>
                </div>
              )}

              {/* PDF Filename Tag */}
              <span
                className="hidden lg:inline-flex items-center text-[11px] font-mono font-medium text-neutral-500 bg-white border border-neutral-200 px-2.5 py-0.5 rounded truncate max-w-[280px]"
                title={`${pdfTitle}.pdf`}
              >
                {pdfTitle}.pdf
              </span>
            </div>

            {/* Right: PDF Toggles Cluster + Zoom Controls */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap shrink-0">
              {/* Toggles */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {bgImage && (
                  <button
                    type="button"
                    onClick={() => setUseBackground(!useBackground)}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                      useBackground
                        ? "border-primary-200 bg-white text-ink shadow-2xs"
                        : "border-neutral-200 bg-neutral-100 text-neutral-400 opacity-60"
                    }`}
                    title="Toggle letterhead background"
                  >
                    <ImageIcon className={`h-3 w-3 ${useBackground ? "text-primary-600" : "text-neutral-400"}`} />
                    <span>Letterhead</span>
                    <span className={`text-[10px] font-bold px-1 rounded ${useBackground ? "bg-primary-100 text-primary-700" : "bg-neutral-200 text-neutral-600"}`}>
                      {useBackground ? "ON" : "OFF"}
                    </span>
                  </button>
                )}

                {annexures.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setUseAnnexures(!useAnnexures)}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                      useAnnexures
                        ? "border-primary-200 bg-white text-ink shadow-2xs"
                        : "border-neutral-200 bg-neutral-100 text-neutral-400 opacity-60"
                    }`}
                    title="Toggle inclusion of annexure pages in printed PDF"
                  >
                    <FileText className={`h-3 w-3 ${useAnnexures ? "text-primary-600" : "text-neutral-400"}`} />
                    <span>Annexures ({annexures.reduce((acc, a) => acc + (a.pages?.length || 0), 0)} pg)</span>
                    <span className={`text-[10px] font-bold px-1 rounded ${useAnnexures ? "bg-primary-100 text-primary-700" : "bg-neutral-200 text-neutral-600"}`}>
                      {useAnnexures ? "ON" : "OFF"}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowSubtotal(!showSubtotal)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    showSubtotal
                      ? "border-primary-200 bg-white text-ink shadow-2xs"
                      : "border-neutral-200 bg-neutral-100 text-neutral-400 opacity-60"
                  }`}
                  title="Toggle Subtotal row"
                >
                  <Calculator className={`h-3 w-3 ${showSubtotal ? "text-primary-600" : "text-neutral-400"}`} />
                  <span>Subtotal</span>
                  <span className={`text-[10px] font-bold px-1 rounded ${showSubtotal ? "bg-primary-100 text-primary-700" : "bg-neutral-200 text-neutral-600"}`}>
                    {showSubtotal ? "ON" : "OFF"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowProfit(!showProfit)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    showProfit
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold shadow-2xs"
                      : "border-neutral-200 bg-neutral-100 text-neutral-400 opacity-60"
                  }`}
                  title="Toggle profit column on PDF"
                >
                  <TrendingUp className={`h-3 w-3 ${showProfit ? "text-emerald-600" : "text-neutral-400"}`} />
                  <span>Profit</span>
                  <span className={`text-[10px] font-bold px-1 rounded ${showProfit ? "bg-emerald-200 text-emerald-800" : "bg-neutral-200 text-neutral-600"}`}>
                    {showProfit ? "ON" : "OFF"}
                  </span>
                </button>
              </div>

              <div className="h-4 w-px bg-neutral-300 hidden sm:block shrink-0" />

              {/* Zoom Controls */}
              <div className="inline-flex items-center rounded-lg border border-border bg-white p-0.5 shadow-2xs shrink-0">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="px-2 py-0.5 text-xs font-bold text-neutral-600 hover:text-black hover:bg-neutral-100 rounded cursor-pointer"
                  title="Zoom Out"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="px-2 py-0.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100 rounded min-w-[42px] text-center cursor-pointer"
                  title="Reset zoom to 100%"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="px-2 py-0.5 text-xs font-bold text-neutral-600 hover:text-black hover:bg-neutral-100 rounded cursor-pointer"
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={handleFitWidth}
                  className="px-2 py-0.5 text-[10.5px] font-semibold text-neutral-600 hover:text-primary-700 hover:bg-neutral-100 rounded cursor-pointer border-l border-neutral-200"
                  title="Fit quotation to screen width"
                >
                  Fit
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Print Preview Container - Perfectly Centered */}
      <main className="w-full flex flex-col items-center justify-start py-4 px-4 print:p-0 print:m-0">
        <div
          className="quotation-sheet-root flex flex-col items-center w-full max-w-[820px] mx-auto print:max-w-none print:m-0"
          style={{
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: "top center",
            transition: "transform 0.15s ease-out",
            marginBottom: zoom > 1 ? `${(isSinglePage ? 1120 : (quotation.items.length * 60 + 1000)) * (zoom - 1)}px` : undefined,
          }}
        >
          <div
            className={`quotation-sheet ${isSinglePage ? "is-single-page" : "is-multi-page"} relative w-full bg-white shadow-2xl print:shadow-none border border-neutral-300 print:border-0 overflow-hidden text-black font-sans leading-normal`}
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
            <div className="border-b-2 border-primary-600 px-10 pt-8 pb-4 flex items-start justify-between">
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoImage}
                  alt={companyName}
                  className="h-14 sm:h-16 w-auto max-w-[280px] object-contain object-left mb-2"
                  onError={(e) => {
                    const fallback = companyName.toLowerCase().includes("meewa") ? "/meewa_logo.png" : "/ananta_logo.png";
                    if (!e.currentTarget.src.endsWith(fallback)) {
                      e.currentTarget.src = fallback;
                    }
                  }}
                />
                {settings?.company_address && <p className="text-[11.5px] text-neutral-600 max-w-sm whitespace-pre-line">{settings.company_address}</p>}
              </div>
              <div className="text-right text-xs text-neutral-600">
                {settings?.company_phone && <p>Tel: {settings.company_phone}</p>}
                {settings?.company_email && <p>Email: {settings.company_email}</p>}
              </div>
            </div>
          )}

          {/* Main Printable Content Container */}
          <div
            className={`quotation-sheet-content flex flex-col ${
              hasBackground
                ? "pt-[175px] px-12 pb-[50px] print:pt-[42mm] print:px-10 print:pb-[22mm]"
                : "px-10 py-6 print:py-5 print:px-8"
            }`}
            style={{ minHeight: hasBackground ? "1120px" : "auto" }}
          >
            {/* Row 1: To & Quotation No / Date */}
            <div className="flex items-start justify-between gap-6 text-[13.5px] print:text-[13px]">
              {/* Left: To */}
              <div className="max-w-[420px]">
                <p className="font-semibold text-black">To,</p>
                {toCompanyOrClient && (
                  <p className="mt-0.5 font-black text-[14.5px] print:text-[13.5px] uppercase tracking-wide text-black">
                    {toCompanyOrClient}
                  </p>
                )}
                {toAddress && (
                  <div className="mt-0.5 whitespace-pre-line text-[13px] print:text-[12px] font-medium leading-snug text-neutral-900">
                    {toAddress}
                  </div>
                )}
              </div>

              {/* Right: Quotation No & Date */}
              <div className="text-right whitespace-nowrap text-[13.5px] print:text-[13px]">
                <p className="font-bold text-black">
                  Quotation No. : <span className="font-black">{quotation.quotation_no}</span>
                </p>
                <p className="mt-1 font-bold text-black">
                  Date : <span className="font-black">{formatQuotationDate(quotation.quotation_date)}</span>
                </p>
              </div>
            </div>

            {/* Row 2: Subject */}
            <div className="mt-5 print:mt-4 text-center">
              <h2 className="inline-block border-b-2 border-black pb-0.5 text-[13.5px] print:text-[13px] font-black tracking-wide text-black uppercase">
                {formattedSubject}
              </h2>
            </div>

            {/* Row 3: Introductory Reference Text */}
            <div className="mt-4 print:mt-3 text-[13px] print:text-[12.5px] font-medium leading-relaxed print:leading-normal text-black text-justify">
              <p>{intro}</p>
            </div>

            {/* Row 4: Line Items Table (Solid black borders matching physical sample) */}
            <div className="mt-4 print:mt-3.5">
              {printViewMode === "detailed" && quotation.detailed_costing_data?.rows?.length ? (
                <>
                  {/* Format 3: Detailed Costing Spreadsheet Table */}
                  <table className="w-full border-collapse border-2 border-black text-[13px] print:text-[12px]">
                  <thead>
                    <tr className="border-b-2 border-black text-[12px] print:text-[11.5px] font-bold uppercase tracking-wider text-black bg-neutral-100/60 print:bg-transparent">
                      <th className="border-r border-black w-14 px-2 py-2 print:py-1.5 text-center">
                        SR. NO.
                      </th>
                      <th className="border-r border-black px-3 py-2 print:py-1.5 text-left">
                        {(quotation.detailed_costing_data.col_item_label || "ITEM / PROCESS").toUpperCase()}
                      </th>
                      {(quotation.detailed_costing_data.custom_columns || []).map((col) => (
                        <th key={col.key} className="border-r border-black px-3 py-2 print:py-1.5 text-center">
                          {col.label.toUpperCase()}
                        </th>
                      ))}
                      <th className="border-r border-black w-28 px-2 py-2 print:py-1.5 text-center">
                        {(quotation.detailed_costing_data.col_qty_label || "QTY.").toUpperCase()}
                      </th>
                      <th className="border-r border-black w-36 px-3 py-2 print:py-1.5 text-center">
                        {(quotation.detailed_costing_data.col_rate_label || "RATE").toUpperCase()}
                      </th>
                      <th className="w-36 px-3 py-2 print:py-1.5 text-right">
                        {(quotation.detailed_costing_data.col_total_label || "TOTAL").toUpperCase()}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.detailed_costing_data.rows
                      .filter((r) => r.item_name && r.item_name.trim().length > 0)
                      .map((r, idx) => {
                        const rowQty = parseFloat(r.qty) || 0;
                        const rowRate = parseFloat(r.rate) || 0;
                        const rowTotal = parseFloat(r.total || "0") || rowQty * rowRate;
                        return (
                          <tr key={r.id || idx} className="border-b border-black">
                            <td className="border-r border-black px-2 py-2 print:py-1.5 text-center font-medium">
                              {idx + 1}
                            </td>
                            <td className="border-r border-black px-3 py-2 print:py-1.5 text-left font-bold text-black">
                              {r.item_name}
                            </td>
                            {(quotation.detailed_costing_data?.custom_columns || []).map((col) => (
                              <td key={col.key} className="border-r border-black px-3 py-2 print:py-1.5 text-center font-medium">
                                {r.custom_fields?.[col.key] || "—"}
                              </td>
                            ))}
                            <td className="border-r border-black px-2 py-2 print:py-1.5 text-center font-medium">
                              {r.qty || "0"}
                            </td>
                            <td className="border-r border-black px-3 py-2 print:py-1.5 text-center font-medium tnum">
                              {formatCurrency(rowRate, currency, 2)}
                            </td>
                            <td className="px-3 py-2 print:py-1.5 text-right font-bold tnum">
                              {formatCurrency(rowTotal, currency, 2)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot>
                    {/* Summary row 1: Total Cost */}
                    <tr className="border-t-2 border-black font-bold text-[12.5px] print:text-[12px]">
                      <td
                        colSpan={2 + (quotation.detailed_costing_data.custom_columns?.length || 0) + 2}
                        className="border-r border-black px-3 py-1.5 print:py-1 text-right uppercase tracking-wider font-extrabold text-neutral-900"
                      >
                        TOTAL RS. (PRODUCTION COST):
                      </td>
                      <td className="px-3 py-1.5 print:py-1 text-right font-black tnum text-neutral-900">
                        {formatCurrency(parseFloat(quotation.detailed_costing_data.total_cost || "0"), currency, 2)}
                      </td>
                    </tr>
                    {/* Summary row 2: Total Qty */}
                    <tr className="border-t border-black font-bold text-[12.5px] print:text-[12px]">
                      <td
                        colSpan={2 + (quotation.detailed_costing_data.custom_columns?.length || 0) + 2}
                        className="border-r border-black px-3 py-1.5 print:py-1 text-right uppercase tracking-wider font-extrabold text-neutral-900"
                      >
                        TOTAL BATCH QTY.:
                      </td>
                      <td className="px-3 py-1.5 print:py-1 text-right font-black tnum text-neutral-900">
                        {quotation.detailed_costing_data.total_qty || "0"} pcs
                      </td>
                    </tr>
                    {/* Summary row 3: Product Cost Per Piece */}
                    <tr className="border-t-2 border-black font-bold text-[13px] print:text-[12.5px] bg-neutral-100/50 print:bg-transparent">
                      <td
                        colSpan={2 + (quotation.detailed_costing_data.custom_columns?.length || 0) + 2}
                        className="border-r border-black px-3 py-2 print:py-1.5 text-right uppercase tracking-wider font-black text-black"
                      >
                        PRODUCT COST / RATE PER PC:
                      </td>
                      <td className="px-3 py-2 print:py-1.5 text-right font-black tnum text-black text-sm">
                        {formatCurrency(
                          parseFloat(
                            quotation.detailed_costing_data.client_rate ||
                              quotation.detailed_costing_data.cost_per_unit ||
                              "0"
                          ),
                          currency,
                          2
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Quantity Comparison Table on Printable Sheet */}
                {Boolean(
                  (quotation.detailed_costing_data?.quantity_tiers || []).some(
                    (t) => t.include_in_whatsapp !== false
                  )
                ) && (
                  <div className="mt-4 print:mt-3 border-2 border-black">
                    <div className="bg-neutral-100 border-b border-black px-3 py-1.5 font-black text-[12px] print:text-[11.5px] uppercase tracking-wider text-black">
                      QUANTITY &amp; RATE COMPARISON OPTIONS
                    </div>
                    <table className="w-full border-collapse text-[12.5px] print:text-[12px]">
                      <thead>
                        <tr className="border-b border-black text-[11.5px] print:text-[11px] font-bold uppercase tracking-wider text-black bg-neutral-50/50">
                          <th className="border-r border-black px-3 py-1.5 text-center">QUANTITY</th>
                          <th className="border-r border-black px-3 py-1.5 text-center">RATE / PC</th>
                          <th className="border-r border-black px-3 py-1.5 text-right">TOTAL AMOUNT</th>
                          <th className="px-3 py-1.5 text-left">REMARKS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(quotation.detailed_costing_data.quantity_tiers || [])
                          .filter((t) => t.include_in_whatsapp !== false)
                          .map((t, idx) => (
                            <tr key={t.id || idx} className="border-b border-black font-medium">
                              <td className="border-r border-black px-3 py-1.5 text-center font-bold text-black">
                                {Number(t.qty || 0).toLocaleString()} pcs
                              </td>
                              <td className="border-r border-black px-3 py-1.5 text-center font-bold text-black tnum">
                                {formatCurrency(parseFloat(t.unit_rate || "0"), currency, 2)}
                              </td>
                              <td className="border-r border-black px-3 py-1.5 text-right font-black text-black tnum">
                                {formatCurrency(parseFloat(t.total_amount || "0"), currency, 2)}
                              </td>
                              <td className="px-3 py-1.5 text-left text-neutral-800">
                                {t.notes || "—"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
                </>
              ) : (
                <table className="w-full border-collapse border-2 border-black text-[13px] print:text-[12px]">
                <thead>
                  <tr className="border-b-2 border-black text-[12px] print:text-[11.5px] font-bold uppercase tracking-wider text-black">
                    <th className="border-r border-black w-14 px-2 py-2 print:py-1.5 text-center">
                      SR. NO.
                    </th>
                    <th className="border-r border-black px-3 py-2 print:py-1.5 text-left">
                      {colNameItem.toUpperCase()}
                    </th>
                    {columns.map((col) => (
                      <th key={col.key} className="border-r border-black px-3 py-2 print:py-1.5 text-center">
                        {col.label.toUpperCase()}
                      </th>
                    ))}
                    {hasAnyItemImage && (
                      <th className="border-r border-black w-24 px-2 py-2 print:py-1.5 text-center">
                        {colNameReference.toUpperCase()}
                      </th>
                    )}
                    <th className="border-r border-black w-24 px-2 py-2 print:py-1.5 text-center">
                      {colNameQty.toUpperCase()}
                    </th>
                    <th className="border-r border-black w-36 px-3 py-2 print:py-1.5 text-center">
                      {colNameRate.toUpperCase()}
                    </th>
                    {showProfit && (
                      <th className="border-r border-black w-32 px-3 py-2 print:py-1.5 text-right">
                        {(quotation.col_labels?.total_profit || "TOTAL PROFIT").toUpperCase()}
                      </th>
                    )}
                    <th className="w-32 px-3 py-2 print:py-1.5 text-right">
                      {colNameAmount.toUpperCase()}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((it, idx) => {
                    const itemQty = parseFloat(it.qty) || 0;
                    const itemRate = parseFloat(it.rate) || 0;
                    const itemAmount = itemQty * itemRate;
                    const itemSupplierRate = parseFloat(it.supplier_rate ?? "0") || 0;
                    const itemProfitPerUnit =
                      parseFloat(it.profit ?? "0") ||
                      (itemRate > itemSupplierRate && itemSupplierRate > 0 ? itemRate - itemSupplierRate : 0);
                    const itemTotalProfit =
                      parseFloat(it.total_profit ?? "0") || itemQty * itemProfitPerUnit;

                    return (
                      <tr key={idx} className="border-b border-black">
                        <td className="border-r border-black px-2 py-2 print:py-1.5 text-center font-medium">
                          {idx + 1}
                        </td>
                        <td className="border-r border-black px-3 py-2 print:py-1.5 text-left font-medium">
                          {it.product_name && (
                            <div className="font-bold text-black">{it.product_name}</div>
                          )}
                          {it.description && (
                            <div className={it.product_name ? "text-xs text-neutral-800 whitespace-pre-wrap mt-0.5" : "whitespace-pre-wrap"}>
                              {it.description}
                            </div>
                          )}
                          {!it.product_name && !it.description && "—"}
                        </td>
                        {columns.map((col) => (
                          <td key={col.key} className="border-r border-black px-3 py-2 print:py-1.5 text-center font-medium">
                            {it.extra_data?.[col.key] ?? "—"}
                          </td>
                        ))}
                        {hasAnyItemImage && (
                          <td className="border-r border-black px-2 py-2 print:py-1.5 text-center align-middle">
                            {it.image ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const validImages = quotation.items
                                    .filter((item) => Boolean(item.image))
                                    .map((item) => ({
                                      image: mediaUrl(item.image!) || item.image!,
                                      caption: item.description || `Item #${idx + 1}`,
                                    }));
                                  const currentImgUrl = mediaUrl(it.image) || it.image;
                                  const targetIdx = validImages.findIndex((img) => img.image === currentImgUrl);
                                  setLightboxImages(validImages);
                                  setLightboxIndex(targetIdx >= 0 ? targetIdx : 0);
                                  setLightboxOpen(true);
                                }}
                                className="group relative mx-auto inline-block cursor-pointer overflow-hidden rounded border border-neutral-400 bg-white p-1 hover:border-black transition-all shadow-xs"
                                title="Click to view full image"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={mediaUrl(it.image) || it.image}
                                  alt={it.description || "Reference image"}
                                  className="h-16 w-16 sm:h-20 sm:w-20 print:h-12 print:w-12 object-contain rounded mx-auto"
                                />
                                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity print:hidden text-white">
                                  <ZoomIn className="h-4 w-4" />
                                </span>
                              </button>
                            ) : (
                              <span className="text-black font-semibold text-sm">—</span>
                            )}
                          </td>
                        )}
                        <td className="border-r border-black px-2 py-2 print:py-1.5 text-center font-medium">
                          {it.qty}
                        </td>
                        <td className="border-r border-black px-3 py-2 print:py-1.5 text-center font-medium tnum">
                          {itemRate > 0 ? formatCurrency(itemRate, currency, 2) : (it.rate ? formatCurrency(it.rate, currency, 2) : "—")}
                        </td>
                        {showProfit && (
                          <td className="border-r border-black px-3 py-2 print:py-1.5 text-right font-medium tnum">
                            {itemTotalProfit !== 0 ? formatCurrency(itemTotalProfit, currency) : "—"}
                          </td>
                        )}
                        <td className="px-3 py-2 print:py-1.5 text-right font-medium tnum">
                          {itemAmount > 0 ? formatCurrency(itemAmount, currency) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {(showSubtotal || showProfit) && (
                  <tfoot>
                    <tr className="border-t-2 border-black font-bold text-[12.5px] print:text-[12px]">
                      <td
                        colSpan={4 + columns.length + (hasAnyItemImage ? 1 : 0)}
                        className="border-r border-black px-3 py-2 print:py-1.5 text-right uppercase tracking-wider font-bold"
                      >
                        {showProfit && showSubtotal
                          ? "TOTAL"
                          : showProfit
                          ? (quotation.col_labels?.total_profit || "TOTAL PROFIT").toUpperCase()
                          : "SUBTOTAL"}
                      </td>
                      {showProfit && (
                        <td className="border-r border-black px-3 py-2 print:py-1.5 text-right font-black tnum">
                          {formatCurrency(totalProfitValue, currency)}
                        </td>
                      )}
                      {showSubtotal ? (
                        <td className="px-3 py-2 print:py-1.5 text-right font-black tnum">
                          {formatCurrency(subtotalValue, currency)}
                        </td>
                      ) : (
                        <td className="px-3 py-2 print:py-1.5 text-right font-normal text-neutral-400">
                          —
                        </td>
                      )}
                    </tr>
                  </tfoot>
                )}
                </table>
              )}
            </div>

            {/* Row 5: NOTES */}
            {notesLines.length > 0 && (
              <div className="prevent-page-break mt-5 print:mt-4 text-[12.5px] print:text-[12px] leading-normal text-black">
                <p className="font-bold underline uppercase tracking-wide">NOTES :</p>
                <div className="mt-1.5 print:mt-1 space-y-1.5 print:space-y-1 pl-0.5">
                  {notesLines.map((line, idx) => {
                    const cleanText = line.replace(/^\d+[\.\)\-]?\s*/, "");
                    return (
                      <div key={idx} className="flex items-start gap-2.5">
                        <span className="font-semibold">{idx + 1}.</span>
                        <span className="font-medium text-black">{cleanText}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Row 6: Sign-off / Signature Block (Left Aligned, unbreakable, naturally following Notes) */}
            <div
              className="signoff-box prevent-page-break mt-6 print:mt-3 text-left text-[13.5px] print:text-[12px] text-black"
              style={{
                breakInside: "avoid",
                pageBreakInside: "avoid",
                display: "inline-block",
                width: "100%",
              }}
            >
              <p className="font-semibold leading-tight">Thank you,</p>
              <div className="my-1 print:my-0.5 h-11 print:h-9 flex items-center">
                {signatureImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signatureImage} alt="Signature" className="max-h-11 print:max-h-9 max-w-[150px] object-contain" />
                ) : (
                  <div className="h-4" />
                )}
              </div>
              <p className="font-black text-[14px] print:text-[13px] text-black tracking-wide leading-tight">{signatureName}</p>
              <p className="text-[12.5px] print:text-[11.5px] font-semibold text-neutral-800 leading-tight mt-0.5">{designation}</p>
              {contactPerson && (
                <p className="text-[12px] print:text-[11px] font-medium text-neutral-700 leading-tight mt-0.5">Contact: {contactPerson}</p>
              )}
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

        {/* Client Quotation PDF Annexures / Attachments Pages */}
        {useAnnexures && annexures.length > 0 && (
          <div className="annexures-container">
            {annexures.map((annexure, aIdx) => (
              <div key={annexure.id || aIdx} className="annexure-group">
                {annexure.pages?.map((pageSrc, pIdx) => (
                  <div
                    key={pIdx}
                    className="annexure-sheet relative mx-auto mt-6 print:mt-0 bg-white shadow-xl print:shadow-none border border-neutral-300 print:border-0 overflow-hidden flex flex-col items-center justify-between"
                    style={{
                      width: "100%",
                      minHeight: "1120px",
                      pageBreakBefore: "always",
                      breakBefore: "page",
                      boxSizing: "border-box",
                    }}
                  >
                    {/* Header with Annexure Title & Page count */}
                    <div className="w-full flex items-center justify-between px-10 pt-6 pb-3 border-b border-neutral-200 text-neutral-600 text-[11px] font-medium print:text-[10px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-800 uppercase tracking-wide">
                          {annexure.title || "Quotation Annexure"}
                        </span>
                        <span className="text-neutral-400">•</span>
                        <span className="text-neutral-500 font-mono text-[10.5px]">
                          {annexure.file_name}
                        </span>
                      </div>
                      <div className="font-semibold text-neutral-700">
                        {quotation.quotation_no} • Page {pIdx + 1} of {annexure.pages.length}
                      </div>
                    </div>

                    {/* Page Content: High-res rendered image */}
                    <div className="flex-1 w-full flex items-center justify-center p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pageSrc.startsWith("data:") || pageSrc.startsWith("blob:") ? pageSrc : (mediaUrl(pageSrc) ?? pageSrc)}
                        alt={`${annexure.title} - Page ${pIdx + 1}`}
                        className="max-w-full max-h-[1010px] w-auto h-auto object-contain shadow-2xs print:shadow-none"
                      />
                    </div>

                    {/* Subtle Footer */}
                    <div className="w-full text-center py-2.5 border-t border-neutral-100 text-[10px] text-neutral-400 font-medium">
                      Attached Annexure for Quotation {quotation.quotation_no}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        </div>
      </main>

      {/* Lightbox for Image Preview */}
      <ImageLightboxModal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={lightboxImages}
        initialIndex={lightboxIndex}
      />
    </div>
  );
}
