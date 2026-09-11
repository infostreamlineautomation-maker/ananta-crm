"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Printer, Image as ImageIcon, FileText, ZoomIn } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { AppSettings, Client, QuotationDetail } from "@/lib/types";
import { formatCurrency, mediaUrl, getBrandLogo } from "@/lib/format";
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
  const toast = useToast();
  const { user, loading: authLoading, can } = useAuth();

  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [clientData, setClientData] = useState<Client | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [useBackground, setUseBackground] = useState(true);
  const [lightboxImages, setLightboxImages] = useState<{ image: string; caption?: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    Promise.all([
      apiFetch<QuotationDetail>(`/api/quotations/${quotationId}/`),
      apiFetch<AppSettings>("/api/settings/"),
    ])
      .then(async ([q, s]) => {
        setQuotation(q);
        setSettings(s);
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
  const designation = settings?.quotation_designation || "Proprietor";
  const logoImage = getBrandLogo(companyName, settings?.logo || settings?.app_logo);

  // Recipient details
  const toCompanyOrClient =
    quotation.to_name ||
    clientData?.company_name ||
    quotation.company_name ||
    clientData?.client_name ||
    quotation.client_name ||
    "";
  const toAddress = quotation.to_address || clientData?.address || quotation.client_address || "";

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
  const intro =
    quotation.intro_text ||
    settings?.quotation_intro ||
    "With The Above Reference, We Are Pleased To Supply The Material With The Following Rates As Per Terms & Conditions Stated Below. Please Sanction The Rates And Place The Order At The Earliest.";

  // Notes lines
  const rawNotes =
    quotation.notes ||
    settings?.quotation_terms ||
    `1. GST Should be Extra as per Government Rules.
2. Transportation charge will be extra as per the Location of Delivery.
3. Payment to be made by Payees A/c. Cheque, Draft or NEFT / RTGS / IMPS only.
4. Subject to Surat Jurisdiction.`;

  const notesLines = rawNotes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const hasBackground = Boolean(bgImage && useBackground);

  return (
    <div className="min-h-screen bg-neutral-200 py-6 print:bg-white print:py-0 print:m-0">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
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
          href={`/quotations/${quotation.id}`}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Quotation
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
          {can("orders", "add") && (
            <Button variant="secondary" onClick={handleCreateOrder} loading={creatingOrder}>
              Create Order
            </Button>
          )}
        </div>
      </div>

      {/* Quotation Sheet */}
      <div className="mx-auto max-w-[820px] pb-16 print:max-w-none print:pb-0">
        <div
          className={`relative mx-auto bg-white shadow-xl print:shadow-none border border-neutral-300 print:border-0 overflow-hidden text-black font-sans leading-normal`}
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
              {/* Row 1: To & Quotation No / Date */}
              <div className="flex items-start justify-between gap-6 text-[13.5px]">
                {/* Left: To */}
                <div className="max-w-[420px]">
                  <p className="font-semibold text-black">To,</p>
                  {toCompanyOrClient && (
                    <p className="mt-0.5 font-black text-[14.5px] uppercase tracking-wide text-black">
                      {toCompanyOrClient}
                    </p>
                  )}
                  {toAddress && (
                    <div className="mt-0.5 whitespace-pre-line text-[13px] font-medium leading-snug text-neutral-900">
                      {toAddress}
                    </div>
                  )}
                </div>

                {/* Right: Quotation No & Date */}
                <div className="text-right whitespace-nowrap text-[13.5px]">
                  <p className="font-bold text-black">
                    Quotation No. : <span className="font-black">{quotation.quotation_no}</span>
                  </p>
                  <p className="mt-1 font-bold text-black">
                    Date : <span className="font-black">{formatQuotationDate(quotation.quotation_date)}</span>
                  </p>
                </div>
              </div>

              {/* Row 2: Subject */}
              <div className="mt-6 text-center">
                <h2 className="inline-block border-b-2 border-black pb-0.5 text-[13.5px] font-black tracking-wide text-black uppercase">
                  {formattedSubject}
                </h2>
              </div>

              {/* Row 3: Introductory Reference Text */}
              <div className="mt-5 text-[13px] font-medium leading-relaxed text-black text-justify">
                <p>{intro}</p>
              </div>

              {/* Row 4: Line Items Table (Solid black borders matching physical sample) */}
              <div className="mt-5">
                <table className="w-full border-collapse border-2 border-black text-[13px]">
                  <thead>
                    <tr className="border-b-2 border-black text-[12px] font-bold uppercase tracking-wider text-black">
                      <th className="border-r border-black w-14 px-2 py-2 text-center">
                        SR. NO.
                      </th>
                      {hasAnyItemImage && (
                        <th className="border-r border-black w-16 px-2 py-2 text-center">
                          IMAGE
                        </th>
                      )}
                      <th className="border-r border-black px-3 py-2 text-left">
                        DESCRIPTION
                      </th>
                      {columns.map((col) => (
                        <th key={col.key} className="border-r border-black px-3 py-2 text-center">
                          {col.label.toUpperCase()}
                        </th>
                      ))}
                      <th className="border-r border-black w-20 px-2 py-2 text-center">
                        {quotation.col_qty_label?.toUpperCase() || "QTY."}
                      </th>
                      <th className="w-36 px-3 py-2 text-center">
                        {quotation.col_rate_label?.toUpperCase() || "RATE (PER PIECE)"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.items.map((it, idx) => (
                      <tr key={idx} className="border-b border-black last:border-b-0">
                        <td className="border-r border-black px-2 py-2.5 text-center font-medium">
                          {idx + 1}
                        </td>
                        {hasAnyItemImage && (
                          <td className="border-r border-black px-1.5 py-1.5 text-center align-middle">
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
                                className="group relative mx-auto inline-block cursor-pointer overflow-hidden rounded border border-neutral-300 bg-neutral-50 p-0.5 hover:border-black transition-all"
                                title="Click to view full image"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={mediaUrl(it.image) || it.image}
                                  alt={it.description || "Item image"}
                                  className="h-10 w-10 object-cover rounded"
                                />
                                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity print:hidden text-white">
                                  <ZoomIn className="h-3.5 w-3.5" />
                                </span>
                              </button>
                            ) : (
                              <span className="text-neutral-400 text-xs">—</span>
                            )}
                          </td>
                        )}
                        <td className="border-r border-black px-3 py-2.5 text-left font-medium">
                          {it.description}
                        </td>
                        {columns.map((col) => (
                          <td key={col.key} className="border-r border-black px-3 py-2.5 text-center font-medium">
                            {it.extra_data?.[col.key] ?? "—"}
                          </td>
                        ))}
                        <td className="border-r border-black px-2 py-2.5 text-center font-medium">
                          {it.qty}
                        </td>
                        <td className="px-3 py-2.5 text-center font-medium">
                          {it.rate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Row 5: NOTES */}
              {notesLines.length > 0 && (
                <div className="mt-6 text-[12.5px] leading-normal text-black">
                  <p className="font-bold underline uppercase tracking-wide">NOTES :</p>
                  <div className="mt-2 space-y-1 pl-0.5">
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
            </div>

            {/* Row 6: Sign-off / Signature Block (Left Aligned) */}
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
