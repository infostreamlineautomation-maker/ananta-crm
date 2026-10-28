"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Calculator,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  FileUp,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { Client, QuotationItemDetail, Supplier } from "@/lib/types";

export interface ParsedQuotationItem {
  description: string;
  qty: string;
  rate: string;
  supplier_rate: string;
  margin_percent: string;
  profit: string;
  total_profit: string;
  amount: string;
  extra_data?: Record<string, any>;
}

export interface ParsedImportResult {
  source_type: "pdf" | "excel";
  document_profile: "customer_quotation" | "costing_breakdown" | "quotation_sheet";
  data: {
    quotation_date: string;
    quote_format?: "standard" | "costing";
    to_name?: string;
    to_address?: string;
    subject?: string;
    intro_text?: string;
    notes?: string;
    client_id?: number | null;
    client_name?: string;
    supplier_id?: number | null;
    supplier_name?: string;
    items: ParsedQuotationItem[];
  };
  missing_fields: Array<{
    field: string;
    label: string;
    reason: string;
  }>;
}

export function QuotationImportModal({
  open,
  onClose,
  onImportSuccess,
  clients = [],
  suppliers = [],
  onQuickAddClient,
  onQuickAddSupplier,
}: {
  open: boolean;
  onClose: () => void;
  onImportSuccess: (data: ParsedImportResult["data"]) => void;
  clients?: Client[];
  suppliers?: Supplier[];
  onQuickAddClient?: () => void;
  onQuickAddSupplier?: () => void;
}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "review">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Review step state
  const [parsedProfile, setParsedProfile] = useState<string>("");
  const [quotationDate, setQuotationDate] = useState("");
  const [subject, setSubject] = useState("");
  const [toName, setToName] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [introText, setIntroText] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | "">("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | "">("");
  const [items, setItems] = useState<ParsedQuotationItem[]>([]);
  const [missingAlerts, setMissingAlerts] = useState<Array<{ field: string; label: string; reason: string }>>([]);
  const [bulkMargin, setBulkMargin] = useState("25");
  const [quoteFormat, setQuoteFormat] = useState<"standard" | "costing">("standard");

  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        value: c.id,
        label: c.company_name ? `${c.client_name} (${c.company_name})` : c.client_name,
        sublabel: c.company_name || undefined,
      })),
    [clients]
  );

  const supplierOptions = useMemo(
    () =>
      suppliers.map((s) => ({
        value: s.id,
        label: s.company_name ? `${s.supplier_name} (${s.company_name})` : s.supplier_name,
        sublabel: s.company_name || undefined,
      })),
    [suppliers]
  );

  function resetState() {
    setStep("upload");
    setSelectedFile(null);
    setIsUploading(false);
    setUploadError(null);
    setParsedProfile("");
    setQuotationDate("");
    setSubject("");
    setToName("");
    setToAddress("");
    setIntroText("");
    setNotes("");
    setSelectedClientId("");
    setSelectedSupplierId("");
    setItems([]);
    setMissingAlerts([]);
    setBulkMargin("25");
    setQuoteFormat("standard");
  }

  function handleModalClose() {
    resetState();
    onClose();
  }

  async function handleFileUpload(file: File) {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const isValid =
      lowerName.endsWith(".pdf") ||
      lowerName.endsWith(".xlsx") ||
      lowerName.endsWith(".xls") ||
      lowerName.endsWith(".csv");

    if (!isValid) {
      setUploadError("Please upload a PDF (.pdf) or Excel (.xlsx, .xls, .csv) document.");
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("quote_format", quoteFormat);

    try {
      const res = await apiFetch<ParsedImportResult>("/api/quotations/parse-import/", {
        method: "POST",
        body: formData,
      });

      // Populate review state
      setParsedProfile(res.document_profile || res.source_type);
      setQuotationDate(res.data.quotation_date || new Date().toISOString().slice(0, 10));
      setSubject(res.data.subject || "QUOTATION");
      setToName(res.data.to_name || "");
      setToAddress(res.data.to_address || "");
      setIntroText(res.data.intro_text || "");
      setNotes(res.data.notes || "");
      setSelectedClientId(res.data.client_id || "");
      setSelectedSupplierId(res.data.supplier_id || "");
      setItems(res.data.items || []);
      setMissingAlerts(res.missing_fields || []);
      setQuoteFormat(quoteFormat || res.data.quote_format || (res.source_type === "excel" ? "costing" : "standard"));

      setStep("review");
      toast.success(`Extracted ${res.data.items?.length || 0} line items from ${file.name}`);
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : (e.message || "Failed to process the document.");
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  }

  const activeMissingAlerts = useMemo(() => {
    if (quoteFormat === "standard") {
      return missingAlerts.filter((m) => m.field !== "supplier" && m.field !== "supplier_rate");
    }
    return missingAlerts;
  }, [missingAlerts, quoteFormat]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }

  function handleItemChange(index: number, patch: Partial<ParsedQuotationItem>) {
    setItems((prev) => {
      const copy = [...prev];
      const cur = { ...copy[index], ...patch };

      const qty = parseFloat(cur.qty) || 0;
      let sRate = parseFloat(cur.supplier_rate) || 0;
      let cRate = parseFloat(cur.rate) || 0;
      let marginPct = parseFloat(cur.margin_percent) || 0;

      // Reactive calculations
      if ("supplier_rate" in patch || "margin_percent" in patch) {
        if (sRate > 0 && marginPct >= 0) {
          const profitUnit = Number((sRate * (marginPct / 100)).toFixed(2));
          cRate = Number((sRate + profitUnit).toFixed(2));
          cur.rate = String(cRate);
          cur.profit = String(profitUnit);
          cur.total_profit = String(Number((profitUnit * qty).toFixed(2)));
        }
      } else if ("rate" in patch) {
        if (cRate > 0) {
          if (sRate > 0) {
            const profitUnit = Math.max(0, Number((cRate - sRate).toFixed(2)));
            cur.profit = String(profitUnit);
            cur.total_profit = String(Number((profitUnit * qty).toFixed(2)));
            cur.margin_percent = String(Number(((profitUnit / sRate) * 100).toFixed(1)));
          } else if (marginPct > 0) {
            sRate = Number((cRate / (1 + marginPct / 100)).toFixed(2));
            cur.supplier_rate = String(sRate);
            const profitUnit = Number((cRate - sRate).toFixed(2));
            cur.profit = String(profitUnit);
            cur.total_profit = String(Number((profitUnit * qty).toFixed(2)));
          }
        }
      } else if ("qty" in patch) {
        const profitUnit = parseFloat(cur.profit) || 0;
        cur.total_profit = String(Number((profitUnit * qty).toFixed(2)));
      }

      cur.amount = String(Number((qty * (parseFloat(cur.rate) || 0)).toFixed(2)));
      copy[index] = cur;
      return copy;
    });
  }

  function handleApplyBulkMargin() {
    const marginNum = parseFloat(bulkMargin) || 25;
    setItems((prev) =>
      prev.map((it) => {
        const qty = parseFloat(it.qty) || 0;
        let sRate = parseFloat(it.supplier_rate) || 0;
        let cRate = parseFloat(it.rate) || 0;

        if (cRate > 0 && sRate === 0) {
          // Customer rate was provided in PDF: calculate supplier cost
          sRate = Number((cRate / (1 + marginNum / 100)).toFixed(2));
        } else if (sRate > 0) {
          // Supplier cost was provided: calculate customer rate
          cRate = Number((sRate * (1 + marginNum / 100)).toFixed(2));
        }

        const profitUnit = Math.max(0, Number((cRate - sRate).toFixed(2)));
        const totProfit = Number((profitUnit * qty).toFixed(2));

        return {
          ...it,
          supplier_rate: String(sRate),
          rate: String(cRate),
          margin_percent: String(marginNum),
          profit: String(profitUnit),
          total_profit: String(totProfit),
          amount: String(Number((qty * cRate).toFixed(2))),
        };
      })
    );
    toast.success(`Applied ${marginNum}% margin across all ${items.length} items.`);
  }

  function handleDeleteItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddItem() {
    setItems((prev) => [
      ...prev,
      {
        description: "",
        qty: "1000",
        supplier_rate: "0",
        margin_percent: "25",
        profit: "0",
        rate: "0",
        total_profit: "0",
        amount: "0",
        extra_data: {},
      },
    ]);
  }

  const totals = useMemo(() => {
    let totalQty = 0;
    let totalCost = 0;
    let totalRevenue = 0;
    let totalProfit = 0;

    for (const it of items) {
      const q = parseFloat(it.qty) || 0;
      const sRate = parseFloat(it.supplier_rate) || 0;
      const cRate = parseFloat(it.rate) || 0;
      totalQty += q;
      totalCost += q * sRate;
      totalRevenue += q * cRate;
      totalProfit += parseFloat(it.total_profit) || q * Math.max(0, cRate - sRate);
    }

    return { totalQty, totalCost, totalRevenue, totalProfit };
  }, [items]);

  function handleConfirmApply() {
    if (!items.length) {
      toast.error("Please ensure at least one line item is present.");
      return;
    }

    const clientObj = clients.find((c) => c.id === selectedClientId);
    const supplierObj = suppliers.find((s) => s.id === selectedSupplierId);

    const payload: ParsedImportResult["data"] = {
      quotation_date: quotationDate,
      quote_format: quoteFormat,
      subject,
      to_name: clientObj?.client_name || toName,
      to_address: clientObj?.address || toAddress,
      intro_text: introText,
      notes,
      client_id: typeof selectedClientId === "number" ? selectedClientId : null,
      client_name: clientObj?.client_name || toName,
      supplier_id: typeof selectedSupplierId === "number" ? selectedSupplierId : null,
      supplier_name: supplierObj?.supplier_name || "",
      items,
    };

    onImportSuccess(payload);
    toast.success("Import applied to quotation successfully!");
    handleModalClose();
  }

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  return (
    <Modal
      open={open}
      onClose={handleModalClose}
      title="Import Quotation from PDF or Excel"
      width="max-w-5xl"
    >
      {step === "upload" && (
        <div className="flex flex-col gap-6 py-2">
          {/* Header intro */}
          <div className="flex items-start gap-3 rounded-lg border border-primary-200 bg-primary-50/60 p-4">
            <Sparkles className="h-5 w-5 text-primary-600 mt-0.5 shrink-0" />
            <div className="text-xs text-ink-muted leading-relaxed">
              <strong className="text-ink font-semibold block text-[13px] mb-0.5">
                Smart PDF &amp; Excel Quotation Extractor
              </strong>
              Upload existing customer quotation PDFs or internal Excel costing sheets. The system extracts items, quantities, and rates into your chosen format.
            </div>
          </div>

          {/* Target Quotation Format Selector */}
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-sunken/40 p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Select Quotation Format Target:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setQuoteFormat("standard")}
                className={clsx(
                  "flex items-start gap-3 rounded-lg border p-3.5 text-left transition-all cursor-pointer",
                  quoteFormat === "standard"
                    ? "border-primary-500 bg-primary-50/70 text-primary-950 shadow-xs ring-1 ring-primary-500/30"
                    : "border-border bg-surface hover:border-border-strong hover:bg-surface-hover/50 text-ink"
                )}
              >
                <div
                  className={clsx(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                    quoteFormat === "standard"
                      ? "border-primary-300 bg-primary-100/80 text-primary-700"
                      : "border-border bg-surface-sunken text-ink-muted"
                  )}
                >
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">Standard Format</span>
                    {quoteFormat === "standard" && (
                      <span className="rounded-full bg-primary-600 px-1.5 py-0.2 text-[9px] font-bold text-white uppercase">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-ink-muted mt-0.5 leading-snug">
                    Direct client quote (Qty, Rate, Amount). Clean &amp; direct format without supplier costing.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setQuoteFormat("costing")}
                className={clsx(
                  "flex items-start gap-3 rounded-lg border p-3.5 text-left transition-all cursor-pointer",
                  quoteFormat === "costing"
                    ? "border-amber-500 bg-amber-50/70 text-amber-950 shadow-xs ring-1 ring-amber-500/30"
                    : "border-border bg-surface hover:border-border-strong hover:bg-surface-hover/50 text-ink"
                )}
              >
                <div
                  className={clsx(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                    quoteFormat === "costing"
                      ? "border-amber-300 bg-amber-100/80 text-amber-700"
                      : "border-border bg-surface-sunken text-ink-muted"
                  )}
                >
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">Calculation Format</span>
                    {quoteFormat === "costing" && (
                      <span className="rounded-full bg-amber-600 px-1.5 py-0.2 text-[9px] font-bold text-white uppercase">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-ink-muted mt-0.5 leading-snug">
                    Costing &amp; calculation format (Supplier Rate, Margin %, Unit Profit &amp; Total Profit).
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragActive(false);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-all cursor-pointer group",
              dragActive
                ? "border-primary-500 bg-primary-50/50"
                : "border-border hover:border-primary-400 hover:bg-surface-sunken/40",
              isUploading && "pointer-events-none opacity-60"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />

            {isUploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
                <div className="text-sm font-semibold text-ink">Analyzing &amp; extracting document data...</div>
                <div className="text-xs text-ink-muted">Parsing line items, quantities, client info &amp; costing</div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600 border border-primary-200 group-hover:scale-105 transition-transform">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success-50 text-success-700 border border-success-200 group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold text-ink">
                    Drag and drop your file here, or{" "}
                    <span className="text-primary-600 hover:underline">browse</span>
                  </p>
                  <p className="text-xs text-ink-muted">
                    Supports <strong>PDF (.pdf)</strong> and <strong>Excel (.xlsx, .xls, .csv)</strong> up to 20MB
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <span className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-[11px] font-medium text-ink-muted border border-border">
                    Quot.pdf (Customer Quotation)
                  </span>
                  <span className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-[11px] font-medium text-ink-muted border border-border">
                    Quotationsample.xlsx (Multi-Tier Matrix)
                  </span>
                  <span className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-[11px] font-medium text-ink-muted border border-border">
                    Costing Sheets (Job Breakdown)
                  </span>
                </div>
              </div>
            )}
          </div>

          {uploadError && (
            <div className="rounded-lg border border-primary-200 bg-primary-50 p-3.5 text-xs text-primary-700 flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
              <button
                type="button"
                onClick={() => setUploadError(null)}
                className="text-primary-600 hover:text-primary-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={handleModalClose}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="flex flex-col gap-6 py-2">
          {/* Top Document Status Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-sunken/60 p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600 border border-primary-200 font-bold text-xs">
                {selectedFile?.name.endsWith(".pdf") ? "PDF" : "XLS"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink">{selectedFile?.name}</span>
                  <span className="rounded-full bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                    {parsedProfile.replace("_", " ")}
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  Extracted {items.length} line items ready for quotation injection.
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep("upload")}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Upload Different File
            </Button>
          </div>

          {/* Review Target Format Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Import Target Format:
              </span>
            </div>
            <div className="inline-flex rounded-lg border border-border bg-surface-sunken p-1 gap-1">
              <button
                type="button"
                onClick={() => setQuoteFormat("standard")}
                className={clsx(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                  quoteFormat === "standard"
                    ? "bg-surface text-primary-700 shadow-xs border border-border font-bold"
                    : "text-ink-muted hover:text-ink"
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                Standard Format
              </button>

              <button
                type="button"
                onClick={() => setQuoteFormat("costing")}
                className={clsx(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                  quoteFormat === "costing"
                    ? "bg-surface text-amber-700 shadow-xs border border-border font-bold"
                    : "text-ink-muted hover:text-ink"
                )}
              >
                <Calculator className="h-3.5 w-3.5" />
                Calculation Format (Costing &amp; Margin)
              </button>
            </div>
          </div>

          {/* Missing / Required Fields Prompt Panel */}
          {activeMissingAlerts.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900 mb-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                Information Confirmation &amp; Resolution
              </div>
              <ul className="space-y-1.5 text-xs text-amber-950">
                {activeMissingAlerts.map((m, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-semibold text-amber-800 shrink-0">• {m.label}:</span>
                    <span>{m.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Header Metadata Inputs: Client & Supplier Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-border p-4 bg-surface">
            {/* Client Matching */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Client / Customer <span className="text-primary-600">*</span>
                </label>
                {selectedClient && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success-700">
                    <CheckCircle2 className="h-3 w-3" /> Matched CRM Client
                  </span>
                )}
              </div>
              <Combobox
                value={selectedClientId || null}
                onChange={(val) => {
                  const num = Number(val);
                  setSelectedClientId(num);
                  const cl = clients.find((c) => c.id === num);
                  if (cl) {
                    setToName(cl.client_name);
                    if (cl.address) setToAddress(cl.address);
                  }
                }}
                options={clientOptions}
                placeholder="Search and select client..."
                onAddNew={onQuickAddClient}
                addNewLabel="+ Add new client"
              />
              {toName && !selectedClientId && (
                <p className="text-[11px] text-ink-faint">
                  Extracted recipient: <strong>{toName}</strong> (select or add matching client above)
                </p>
              )}
            </div>

            {/* Supplier Matching */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Fulfilling Supplier / Vendor {quoteFormat === "costing" && <span className="text-primary-600">*</span>}
                </label>
                {selectedSupplier && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success-700">
                    <CheckCircle2 className="h-3 w-3" /> Matched CRM Supplier
                  </span>
                )}
              </div>
              <Combobox
                value={selectedSupplierId || null}
                onChange={(val) => setSelectedSupplierId(Number(val))}
                options={supplierOptions}
                placeholder={quoteFormat === "costing" ? "Search and select fulfilling supplier..." : "Optional: select supplier..."}
                onAddNew={onQuickAddSupplier}
                addNewLabel="+ Add new supplier"
              />
              <p className="text-[11px] text-ink-faint">
                {quoteFormat === "costing"
                  ? "Internal production vendor who manufactures or supplies this order."
                  : "Optional supplier linkage for this quotation."}
              </p>
            </div>

            {/* Quotation Date & Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Quotation Date
              </label>
              <Input
                type="date"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Subject
              </label>
              <Input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="QUOTATION FOR..."
              />
            </div>
          </div>

          {/* Quick Bulk Margin Utility (Only in Costing/Calculation mode) */}
          {quoteFormat === "costing" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary-600" />
                <div>
                  <span className="text-xs font-bold text-ink">Two-Way Profit Margin Calculator</span>
                  <p className="text-[11px] text-ink-muted">
                    Calculate supplier cost from customer selling rate, or calculate selling rate from supplier cost.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-surface rounded-md border border-border px-2 py-1">
                  <span className="text-xs font-medium text-ink-muted">Margin:</span>
                  <input
                    type="number"
                    step="0.1"
                    value={bulkMargin}
                    onChange={(e) => setBulkMargin(e.target.value)}
                    className="w-14 text-xs font-bold text-ink focus:outline-none"
                  />
                  <span className="text-xs font-medium text-ink-muted">%</span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleApplyBulkMargin}
                  className="text-xs font-semibold"
                >
                  Apply to All Items
                </Button>
              </div>
            </div>
          )}

          {/* Extracted Line Items Review Table */}
          <div className="rounded-lg border border-border overflow-hidden bg-surface">
            <div className="flex items-center justify-between border-b border-border bg-surface-sunken/40 px-4 py-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-ink">
                Line Items ({items.length})
              </span>
              <Button variant="ghost" size="sm" onClick={handleAddItem} className="gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add Item
              </Button>
            </div>

            <div className="overflow-x-auto max-h-[340px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-sunken/80 border-b border-border text-[11px] font-bold uppercase tracking-wider text-ink-muted sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 w-10 text-center">#</th>
                    <th className="px-3 py-2 min-w-[200px]">Description</th>
                    <th className="px-3 py-2 w-24 text-right">Qty</th>
                    {quoteFormat === "costing" ? (
                      <>
                        <th className="px-3 py-2 w-28 text-right bg-amber-50/40 text-amber-900">
                          Supplier Rate (₹)
                        </th>
                        <th className="px-3 py-2 w-20 text-right">Margin %</th>
                        <th className="px-3 py-2 w-24 text-right">Unit Profit (₹)</th>
                        <th className="px-3 py-2 w-28 text-right bg-primary-50/40 text-primary-900 font-bold">
                          Client Rate (₹)
                        </th>
                        <th className="px-3 py-2 w-28 text-right font-bold">Total Amount (₹)</th>
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-2 w-32 text-right bg-primary-50/40 text-primary-900 font-bold">
                          Rate (₹)
                        </th>
                        <th className="px-3 py-2 w-32 text-right font-bold">Total Amount (₹)</th>
                      </>
                    )}
                    <th className="px-3 py-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-surface-sunken/30 transition-colors">
                      <td className="px-3 py-2 text-center text-ink-muted font-medium">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={it.description}
                          onChange={(e) => handleItemChange(idx, { description: e.target.value })}
                          className="w-full rounded border border-border bg-surface px-2 py-1 text-xs font-medium text-ink focus:border-primary-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={it.qty}
                          onChange={(e) => handleItemChange(idx, { qty: e.target.value })}
                          className="w-full rounded border border-border bg-surface px-2 py-1 text-right text-xs font-medium text-ink focus:border-primary-500 focus:outline-none"
                        />
                      </td>
                      {quoteFormat === "costing" ? (
                        <>
                          <td className="px-3 py-2 text-right bg-amber-50/20">
                            <input
                              type="number"
                              step="0.01"
                              value={it.supplier_rate}
                              onChange={(e) => handleItemChange(idx, { supplier_rate: e.target.value })}
                              className="w-full rounded border border-amber-300 bg-surface px-2 py-1 text-right text-xs font-semibold text-amber-950 focus:border-primary-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              step="0.1"
                              value={it.margin_percent}
                              onChange={(e) => handleItemChange(idx, { margin_percent: e.target.value })}
                              className="w-full rounded border border-border bg-surface px-2 py-1 text-right text-xs font-medium text-ink focus:border-primary-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-success-700">
                            ₹{parseFloat(it.profit || "0").toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right bg-primary-50/20">
                            <input
                              type="number"
                              step="0.01"
                              value={it.rate}
                              onChange={(e) => handleItemChange(idx, { rate: e.target.value })}
                              className="w-full rounded border border-primary-300 bg-surface px-2 py-1 text-right text-xs font-bold text-primary-700 focus:border-primary-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-ink">
                            ₹{parseFloat(it.amount || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-right bg-primary-50/20">
                            <input
                              type="number"
                              step="0.01"
                              value={it.rate}
                              onChange={(e) => handleItemChange(idx, { rate: e.target.value })}
                              className="w-full rounded border border-primary-300 bg-surface px-2 py-1 text-right text-xs font-bold text-primary-700 focus:border-primary-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-ink">
                            ₹{parseFloat(it.amount || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(idx)}
                          className="text-ink-muted hover:text-primary-600 transition-colors p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-surface-sunken/70 font-bold text-ink">
                  <tr>
                    <td colSpan={2} className="px-3 py-2.5 text-right uppercase text-[11px] text-ink-muted">
                      Totals:
                    </td>
                    <td className="px-3 py-2.5 text-right">{totals.totalQty.toLocaleString("en-IN")}</td>
                    {quoteFormat === "costing" ? (
                      <>
                        <td className="px-3 py-2.5 text-right text-amber-900">
                          ₹{totals.totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2.5 text-right">—</td>
                        <td className="px-3 py-2.5 text-right text-success-700">
                          ₹{totals.totalProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2.5 text-right">—</td>
                        <td className="px-3 py-2.5 text-right text-primary-700 text-sm">
                          ₹{totals.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2.5 text-right text-primary-700 text-sm">
                          ₹{totals.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </>
                    )}
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setStep("upload")} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back to Upload
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleModalClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmApply} className="gap-1.5 px-6 font-semibold">
                <Check className="h-4 w-4" /> Apply to Quotation
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
