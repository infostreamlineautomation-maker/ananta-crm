"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { consumeJustCreated, resolveRedirect, clearCreationOrigin } from "@/lib/creation-redirect";
import clsx from "clsx";
import {
  Calculator,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  FileUp,
  ImageIcon,
  MessageSquare,
  Paperclip,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useList } from "@/lib/hooks";
import {
  AppSettings,
  Client,
  Company,
  Country,
  Product,
  ProjectSummary,
  QuotationAttachment,
  QuotationColumn,
  QuotationDetail,
  QuotationItemDetail,
  QuotationStatus,
  Supplier,
} from "@/lib/types";
import { formatCurrency, mediaUrl } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { useForex } from "@/lib/forex";
import { useOrganization } from "@/lib/organization-context";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Combobox } from "@/components/ui/Combobox";
import { SlideOver } from "@/components/ui/SlideOver";
import { ClientForm } from "../clients/page";
import { SupplierForm } from "../suppliers/page";
import { ProductModal } from "@/components/products/ProductModal";
import { ActivityTimeline } from "@/components/ui/ActivityTimeline";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";
import { QuotationImportModal } from "@/components/quotations/QuotationImportModal";
import { AttachmentViewerModal } from "@/components/ui/AttachmentViewerModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DraftBanner } from "@/components/ui/DraftBanner";
import { useFormDraft } from "@/lib/useFormDraft";

function blankItem(): QuotationItemDetail {
  return {
    product: null,
    product_name: null,
    description: "",
    qty: "1000",
    supplier_rate: "0",
    profit: "0",
    margin_percent: "25",
    rate: "0",
    total_profit: "0",
    amount: "0",
    image: null,
    extra_data: {},
  };
}

function InlineItemCell({
  item,
  index,
  products,
  datalistId,
  onProductNameChange,
  onDescriptionChange,
  onOpenProductModal,
}: {
  item: QuotationItemDetail;
  index: number;
  products: Product[];
  datalistId: string;
  onProductNameChange: (index: number, name: string) => void;
  onDescriptionChange: (index: number, desc: string) => void;
  onOpenProductModal: (index: number) => void;
}) {
  const currentName =
    item.product_name ??
    (item.product ? products.find((p) => p.id === item.product)?.product_name : "") ??
    "";

  return (
    <div className="flex flex-col gap-1.5 py-1">
      {/* Top Row: Direct input for item / product name with datalist suggestions + Quick Add (+) Button */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <Input
            value={currentName}
            onChange={(e) => onProductNameChange(index, e.target.value)}
            placeholder="Select item *"
            list={datalistId}
            className="font-medium text-ink h-8.5 text-xs"
          />
          <datalist id={datalistId}>
            {products.map((p) => (
              <option key={p.id} value={p.product_name} />
            ))}
          </datalist>
        </div>

        {/* Quick Add Product Button */}
        <button
          type="button"
          onClick={() => onOpenProductModal(index)}
          className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-md border border-border bg-surface-sunken hover:bg-surface-hover hover:border-primary-400 text-ink-muted hover:text-primary-700 transition shadow-2xs cursor-pointer"
          title="Add new item / product to catalog"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom Row: Additional Description For Item (Textarea) */}
      <textarea
        value={item.description}
        onChange={(e) => onDescriptionChange(index, e.target.value)}
        rows={2}
        placeholder="Additional Description For Item"
        className="w-full resize-y rounded-md border border-border/80 bg-white px-2.5 py-1.5 text-xs text-ink placeholder:italic placeholder:text-ink-faint/80 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-100 transition-colors shadow-2xs"
      />
    </div>
  );
}

let columnCounter = 0;
function newColumnKey() {
  columnCounter += 1;
  return `custom_${Date.now()}_${columnCounter}`;
}

export function QuotationForm({
  quotation,
  initialProjectId,
  initialFormat,
}: {
  quotation?: QuotationDetail;
  initialProjectId?: number;
  initialFormat?: "standard" | "costing";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { activeOrganization } = useOrganization();
  const baseCurrency = activeOrganization?.default_currency_code || "INR";
  const { rates, getRate } = useForex();
  const { can } = useAuth();

  const { items: rawClients, reload: reloadClients } = useList<Client>("/api/clients/?page_size=200");
  const { items: companies } = useList<Company>("/api/companies/?page_size=200");
  const { items: countries } = useList<Country>("/api/countries/");
  const { items: rawSuppliers, reload: reloadSuppliers } = useList<Supplier>("/api/suppliers/?page_size=300");
  const { items: products, reload: reloadProducts } = useList<Product>("/api/products/?page_size=500");
  const { items: projects } = useList<ProjectSummary>("/api/projects/?page_size=200");

  const [clients, setClients] = useState<Client[]>([]);
  useEffect(() => {
    if (rawClients.length) setClients(rawClients);
  }, [rawClients]);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  useEffect(() => {
    if (rawSuppliers.length) setSuppliers(rawSuppliers);
  }, [rawSuppliers]);

  const [quickAddClientOpen, setQuickAddClientOpen] = useState(false);
  const [quickAddSupplierOpen, setQuickAddSupplierOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [activeProductRowIndex, setActiveProductRowIndex] = useState<number | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | "">("");
  const [previewLightboxImage, setPreviewLightboxImage] = useState<string | null>(null);

  // Section 0: Quotation Header
  const [quotationDate, setQuotationDate] = useState(
    quotation?.quotation_date ?? new Date().toISOString().slice(0, 10)
  );
  const [client, setClient] = useState<number | "">(quotation?.client ?? "");
  const [project, setProject] = useState<number | "">(quotation?.project ?? initialProjectId ?? "");
  const [supplierId, setSupplierId] = useState<number | "">(quotation?.supplier ?? "");
  const [subject, setSubject] = useState(quotation?.subject ?? "");
  const [toName, setToName] = useState(quotation?.to_name ?? "");
  const [toAddress, setToAddress] = useState(quotation?.to_address ?? "");
  const [currencyCode, setCurrencyCode] = useState(quotation?.currency_code ?? "");
  const [status, setStatus] = useState<QuotationStatus>(quotation?.status ?? "draft");
  const [quoteFormat, setQuoteFormat] = useState<"standard" | "costing">(
    quotation?.quote_format || initialFormat || "standard"
  );

  // Section 1: Line Items / Supplier Costing Table
  const [columns, setColumns] = useState<QuotationColumn[]>(quotation?.columns_config ?? []);
  const [colQtyLabel, setColQtyLabel] = useState(quotation?.col_qty_label ?? "Qty");
  const [colRateLabel, setColRateLabel] = useState(quotation?.col_rate_label ?? "Client Rate");
  const [colLabels, setColLabels] = useState<Record<string, string>>(() => {
    const saved = quotation?.col_labels || {};
    return {
      item: saved.item || "Item & Description",
      reference: saved.reference || "Reference",
      amount: saved.amount || "Amount",
      supplier_group: saved.supplier_group || "Supplier Qty & Rate",
      supplier_qty: saved.supplier_qty || quotation?.col_qty_label || "Qty.",
      supplier_rate: saved.supplier_rate || "Rate",
      client_group: saved.client_group || "Client Given Rate (Profit Calculation)",
      margin_percent: saved.margin_percent || "Add %",
      profit: saved.profit || "Profit",
      client_rate: saved.client_rate || quotation?.col_rate_label || "Client Rate",
      total_profit: saved.total_profit || "Total Profit",
      ...saved,
    };
  });

  const updateColLabel = (key: string, val: string) => {
    setColLabels((prev) => ({ ...prev, [key]: val }));
  };

  const [showSubtotalInPdf, setShowSubtotalInPdf] = useState<boolean>(() => {
    if (quotation?.col_labels?.show_subtotal !== undefined) {
      return String(quotation.col_labels.show_subtotal) === "true" || quotation.col_labels.show_subtotal === true;
    }
    return true;
  });

  const [showProfitInPdf, setShowProfitInPdf] = useState<boolean>(() => {
    if (quotation?.col_labels?.show_profit !== undefined) {
      return String(quotation.col_labels.show_profit) === "true" || quotation.col_labels.show_profit === true;
    }
    return false;
  });
  const [items, setItems] = useState<QuotationItemDetail[]>(() => {
    if (quotation?.items?.length) {
      return quotation.items.map((it) => {
        const q = parseFloat(it.qty) || 0;
        const sRate = parseFloat(it.supplier_rate ?? "0") || 0;
        const cRate = parseFloat(it.rate) || 0;
        let profit =
          parseFloat(it.profit ?? "0") || (cRate > sRate && sRate > 0 ? cRate - sRate : 0);
        let marginPct =
          parseFloat(it.margin_percent ?? "0") ||
          (sRate > 0 ? Number(((profit / sRate) * 100).toFixed(2)) : 0);
        let totalProfit = parseFloat(it.total_profit ?? "0") || q * profit;
        let amount = parseFloat(it.amount ?? "0") || q * cRate;

        // Backward compatibility: If legacy item has no product or product_name, use description as product_name
        let pName = it.product_name ?? null;
        let desc = it.description ?? "";
        if (!pName && !it.product && desc) {
          const lines = desc.split("\n");
          if (lines.length > 1) {
            pName = lines[0].trim();
            desc = lines.slice(1).join("\n").trim();
          } else {
            pName = desc.trim();
            desc = "";
          }
        }

        return {
          ...it,
          product: it.product ?? null,
          product_name: pName,
          description: desc,
          supplier_rate: String(sRate || "0"),
          profit: String(profit || "0"),
          margin_percent: String(marginPct || "0"),
          rate: String(cRate || "0"),
          total_profit: String(totalProfit || "0"),
          amount: String(amount || "0"),
        };
      });
    }
    return [blankItem()];
  });

  // Section 2: WhatsApp Proposal
  const [whatsappText, setWhatsappText] = useState(quotation?.whatsapp_message ?? "");
  const [isWhatsappCustomized, setIsWhatsappCustomized] = useState(
    Boolean(quotation?.whatsapp_message)
  );
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappCopied, setWhatsappCopied] = useState(false);

  // Section 2.5: Admin Remarks & Attachments (Internal Record)
  const [adminRemarks, setAdminRemarks] = useState(quotation?.admin_remarks ?? "");
  const [attachments, setAttachments] = useState<QuotationAttachment[]>(quotation?.attachments ?? []);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingAnnexure, setIsDraggingAnnexure] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<QuotationAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfAnnexureFileInputRef = useRef<HTMLInputElement>(null);

  // Section 3: Notes & Terms
  const [introText, setIntroText] = useState(
    quotation?.intro_text ??
      "With The Above Reference, We Are Pleased To Supply The Material With The Following Rates As Per Terms & Conditions Stated Below. Please Sanction The Rates And Place The Order At The Earliest."
  );
  const [notes, setNotes] = useState(
    quotation?.notes ??
      "1. GST Should be Extra as per Government Rules.\n2. Transportation charge will be extra as per the Location of Delivery.\n3. Payment to be made by Payees A/c. Cheque, Draft or NEFT / RTGS / IMPS only.\n4. Subject to Surat Jurisdiction."
  );
  const [footerContent, setFooterContent] = useState(quotation?.footer_content ?? "");
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    apiFetch<AppSettings>("/api/settings/")
      .then((s) => {
        setAppSettings(s);
        if (!quotation) {
          if (s.quotation_intro && s.quotation_intro.trim()) {
            setIntroText(s.quotation_intro);
          }
          if (s.quotation_terms && s.quotation_terms.trim()) {
            setNotes(s.quotation_terms);
          }
        } else {
          const isDefaultIntro = !quotation.intro_text || quotation.intro_text.includes("With The Above Reference");
          if (isDefaultIntro && s.quotation_intro && s.quotation_intro.trim()) {
            setIntroText(s.quotation_intro);
          }
          const isDefaultNotes = !quotation.notes || quotation.notes.includes("GST Should be Extra");
          if (isDefaultNotes && s.quotation_terms && s.quotation_terms.trim()) {
            setNotes(s.quotation_terms);
          }
        }
      })
      .catch(() => {});
  }, [quotation]);

  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Confirmation dialog states
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ index: number; name: string } | null>(null);
  const [attachmentToDelete, setAttachmentToDelete] = useState<{ index: number; att: QuotationAttachment } | null>(null);

  // Form Draft Caching & Auto-restore
  const draftKey = quotation ? `crm_draft_quote_${quotation.id}` : "crm_draft_quote_new";
  const formData = useMemo(
    () => ({
      client,
      project,
      supplierId,
      subject,
      toName,
      toAddress,
      quotationDate,
      currencyCode,
      status,
      quoteFormat,
      columns,
      colQtyLabel,
      colRateLabel,
      colLabels,
      showSubtotalInPdf,
      showProfitInPdf,
      items,
      whatsappText,
      isWhatsappCustomized,
      adminRemarks,
      introText,
      notes,
      footerContent,
      attachments,
    }),
    [
      client,
      project,
      supplierId,
      subject,
      toName,
      toAddress,
      quotationDate,
      currencyCode,
      status,
      quoteFormat,
      columns,
      colQtyLabel,
      colRateLabel,
      colLabels,
      showSubtotalInPdf,
      showProfitInPdf,
      items,
      whatsappText,
      isWhatsappCustomized,
      adminRemarks,
      introText,
      notes,
      footerContent,
      attachments,
    ]
  );

  const isDirty = useMemo(() => {
    const initialShowSubtotal = quotation?.col_labels?.show_subtotal !== undefined
      ? String(quotation.col_labels.show_subtotal) === "true" || quotation.col_labels.show_subtotal === true
      : true;
    const initialShowProfit = quotation?.col_labels?.show_profit !== undefined
      ? String(quotation.col_labels.show_profit) === "true" || quotation.col_labels.show_profit === true
      : false;

    if (!quotation) {
      return Boolean(
        client ||
          toName ||
          subject ||
          adminRemarks ||
          attachments.length > 0 ||
          items.length > 1 ||
          items[0]?.product ||
          items[0]?.product_name ||
          items[0]?.rate ||
          (items[0]?.qty && items[0]?.qty !== "1") ||
          !showSubtotalInPdf ||
          showProfitInPdf
      );
    }
    return (
      client !== (quotation.client ?? "") ||
      project !== (quotation.project ?? "") ||
      supplierId !== (quotation.supplier ?? "") ||
      subject !== (quotation.subject ?? "") ||
      toName !== (quotation.to_name ?? "") ||
      toAddress !== (quotation.to_address ?? "") ||
      quotationDate !== (quotation.quotation_date ?? "") ||
      status !== (quotation.status ?? "draft") ||
      adminRemarks !== (quotation.admin_remarks ?? "") ||
      introText !== (quotation.intro_text ?? "") ||
      notes !== (quotation.notes ?? "") ||
      showSubtotalInPdf !== initialShowSubtotal ||
      showProfitInPdf !== initialShowProfit ||
      attachments.length !== (quotation.attachments?.length ?? 0)
    );
  }, [quotation, client, project, supplierId, subject, toName, toAddress, quotationDate, status, adminRemarks, introText, notes, items, attachments, showSubtotalInPdf, showProfitInPdf]);

  const {
    draftSavedAt,
    draftRestored,
    dismissDraftBanner,
    clearDraft,
  } = useFormDraft({
    key: draftKey,
    data: formData,
    isDirty,
    onRestore: (draft) => {
      if (draft.client !== undefined) setClient(draft.client);
      if (draft.project !== undefined) setProject(draft.project);
      if (draft.supplierId !== undefined) setSupplierId(draft.supplierId);
      if (draft.subject !== undefined) setSubject(draft.subject);
      if (draft.toName !== undefined) setToName(draft.toName);
      if (draft.toAddress !== undefined) setToAddress(draft.toAddress);
      if (draft.quotationDate !== undefined) setQuotationDate(draft.quotationDate);
      if (draft.currencyCode !== undefined) setCurrencyCode(draft.currencyCode);
      if (draft.status !== undefined) setStatus(draft.status);
      if (draft.quoteFormat !== undefined) setQuoteFormat(draft.quoteFormat);
      if (draft.columns !== undefined) setColumns(draft.columns);
      if (draft.colQtyLabel !== undefined) setColQtyLabel(draft.colQtyLabel);
      if (draft.colRateLabel !== undefined) setColRateLabel(draft.colRateLabel);
      if (draft.colLabels !== undefined) setColLabels(draft.colLabels);
      if (draft.showSubtotalInPdf !== undefined) setShowSubtotalInPdf(draft.showSubtotalInPdf);
      if (draft.showProfitInPdf !== undefined) setShowProfitInPdf(draft.showProfitInPdf);
      if (draft.items !== undefined && Array.isArray(draft.items) && draft.items.length > 0) setItems(draft.items);
      if (draft.whatsappText !== undefined) setWhatsappText(draft.whatsappText);
      if (draft.isWhatsappCustomized !== undefined) setIsWhatsappCustomized(draft.isWhatsappCustomized);
      if (draft.adminRemarks !== undefined) setAdminRemarks(draft.adminRemarks);
      if (draft.introText !== undefined) setIntroText(draft.introText);
      if (draft.notes !== undefined) setNotes(draft.notes);
      if (draft.footerContent !== undefined) setFooterContent(draft.footerContent);
      if (draft.attachments !== undefined && Array.isArray(draft.attachments)) setAttachments(draft.attachments);
    },
  });

  function handleDiscardDraft() {
    clearDraft();
    if (quotation) {
      setClient(quotation.client ?? "");
      setProject(quotation.project ?? initialProjectId ?? "");
      setSupplierId(quotation.supplier ?? "");
      setSubject(quotation.subject ?? "");
      setToName(quotation.to_name ?? "");
      setToAddress(quotation.to_address ?? "");
      setQuotationDate(quotation.quotation_date ?? new Date().toISOString().slice(0, 10));
      setCurrencyCode(quotation.currency_code ?? "");
      setStatus(quotation.status ?? "draft");
      setQuoteFormat(quotation.quote_format || initialFormat || "standard");
      setColumns(quotation.columns_config ?? []);
      setColLabels(quotation.col_labels || {});
      setShowSubtotalInPdf(
        quotation.col_labels?.show_subtotal !== undefined
          ? String(quotation.col_labels.show_subtotal) === "true" || quotation.col_labels.show_subtotal === true
          : true
      );
      setShowProfitInPdf(
        quotation.col_labels?.show_profit !== undefined
          ? String(quotation.col_labels.show_profit) === "true" || quotation.col_labels.show_profit === true
          : false
      );
      setItems(quotation.items?.length ? quotation.items : [blankItem()]);
      setWhatsappText(quotation.whatsapp_message ?? "");
      setIsWhatsappCustomized(Boolean(quotation.whatsapp_message));
      setAdminRemarks(quotation.admin_remarks ?? "");
      setIntroText(quotation.intro_text ?? appSettings?.quotation_intro ?? "");
      setNotes(quotation.notes ?? appSettings?.quotation_terms ?? "");
      setFooterContent(quotation.footer_content ?? "");
      setAttachments(quotation.attachments ?? []);
    } else {
      setClient("");
      setProject(initialProjectId ?? "");
      setSupplierId("");
      setSubject("");
      setToName("");
      setToAddress("");
      setQuotationDate(new Date().toISOString().slice(0, 10));
      setCurrencyCode("");
      setStatus("draft");
      setQuoteFormat(initialFormat || "standard");
      setColumns([]);
      setColLabels({});
      setShowSubtotalInPdf(true);
      setShowProfitInPdf(false);
      setItems([blankItem()]);
      setWhatsappText("");
      setIsWhatsappCustomized(false);
      setAdminRemarks("");
      setIntroText(appSettings?.quotation_intro ?? "");
      setNotes(appSettings?.quotation_terms ?? "");
      setFooterContent("");
      setAttachments([]);
    }
    toast.success("Draft discarded.");
  }

  function applyImportedData(data: any) {
    if (!data) return;
    if (data.quotation_date) setQuotationDate(data.quotation_date);
    if (data.quote_format) setQuoteFormat(data.quote_format);
    if (data.client_id) setClient(data.client_id);
    if (data.to_name) setToName(data.to_name);
    if (data.to_address) setToAddress(data.to_address);
    if (data.subject) setSubject(data.subject);
    if (data.supplier_id) setSupplierId(data.supplier_id);
    if (data.intro_text) setIntroText(data.intro_text);
    if (data.notes) setNotes(data.notes);
    if (data.admin_remarks) setAdminRemarks(data.admin_remarks);
    if (data.col_qty_label) setColQtyLabel(data.col_qty_label);
    if (data.col_rate_label) setColRateLabel(data.col_rate_label);
    if (data.col_labels) {
      setColLabels((prev) => ({ ...prev, ...data.col_labels }));
      if (data.col_labels.show_subtotal !== undefined) {
        setShowSubtotalInPdf(String(data.col_labels.show_subtotal) === "true" || data.col_labels.show_subtotal === true);
      }
      if (data.col_labels.show_profit !== undefined) {
        setShowProfitInPdf(String(data.col_labels.show_profit) === "true" || data.col_labels.show_profit === true);
      }
    }
    if (data.items && data.items.length) {
      setItems(
        data.items.map((it: any) => ({
          ...blankItem(),
          description: it.description || "",
          qty: String(it.qty || "1000"),
          supplier_rate: String(it.supplier_rate || "0"),
          margin_percent: String(it.margin_percent || "25"),
          profit: String(it.profit || "0"),
          rate: String(it.rate || "0"),
          total_profit: String(it.total_profit || "0"),
          amount: String(it.amount || "0"),
          extra_data: it.extra_data || {},
        }))
      );
    }
  }

  // Hydrate from sessionStorage if imported from Quotations list page
  useEffect(() => {
    if (!quotation) {
      try {
        const stored = sessionStorage.getItem("imported_quotation");
        if (stored) {
          const parsed = JSON.parse(stored);
          sessionStorage.removeItem("imported_quotation");
          applyImportedData(parsed);
          toast.success("Loaded imported quotation data!");
        }
      } catch (e) {
        // ignore
      }
    }
  }, [quotation]);

  const selectedClient = clients.find((c) => c.id === client);
  const selectedCompany = companies.find((comp) => comp.id === selectedCompanyId || (selectedClient?.company && comp.id === selectedClient.company));
  const effectiveCurrency = currencyCode || selectedClient?.currency_code || baseCurrency;

  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        value: c.id,
        label: c.company_name ? `${c.client_name} (${c.company_name})` : c.client_name,
        sublabel: c.company_name || undefined,
      })),
    [clients]
  );

  const companyOptions = useMemo(
    () =>
      companies.map((comp) => ({
        value: comp.id,
        label: comp.company_name,
        sublabel: [comp.city, comp.contact_name].filter(Boolean).join(" · ") || undefined,
      })),
    [companies]
  );

  const supplierOptions = useMemo(
    () =>
      suppliers.map((s) => ({
        value: s.id,
        label: s.supplier_name,
        sublabel: [s.address, s.contact].filter(Boolean).join(" · ") || undefined,
      })),
    [suppliers]
  );

  // Auto-sync recipient phone number for WhatsApp
  useEffect(() => {
    if (selectedClient?.phone) {
      setWhatsappPhone(selectedClient.phone);
    } else if (selectedCompany?.contact_phone || selectedCompany?.company_phone) {
      setWhatsappPhone(selectedCompany.contact_phone || selectedCompany.company_phone || "");
    }
  }, [selectedClient, selectedCompany]);

  // Auto-fill company details directly when picking a company
  const handleCompanySelect = (newCompId: number) => {
    setSelectedCompanyId(newCompId);
    const comp = companies.find((c) => c.id === newCompId);
    if (comp) {
      setToName(comp.company_name);
      const addrParts = [
        comp.address,
        comp.city,
        comp.state,
        comp.zip_code,
        comp.country_name,
      ].filter(Boolean);
      setToAddress(addrParts.join(", ") || comp.address || "");

      const matchingClient = clients.find((c) => c.company === comp.id);
      if (matchingClient && !client) {
        setClient(matchingClient.id);
      }
      toast.success(`Auto-filled company data for "${comp.company_name}".`);
    }
  };

  // Auto-sync client's details, linked company data, and currency
  const handleClientChange = (newClientId: number) => {
    setClient(newClientId);
    const cli = clients.find((c) => c.id === newClientId);
    if (cli) {
      let comp: Company | undefined;
      if (cli.company) {
        comp = companies.find((c) => c.id === cli.company);
      }
      if (comp) {
        setSelectedCompanyId(comp.id);
        setToName(comp.company_name || cli.company_name || cli.client_name);
        const addrParts = [
          comp.address,
          comp.city,
          comp.state,
          comp.zip_code,
          comp.country_name,
        ].filter(Boolean);
        setToAddress(addrParts.join(", ") || comp.address || cli.address || "");
      } else {
        if (!toName || toName.trim() === "") {
          setToName(cli.company_name || cli.client_name);
        }
        if (!toAddress || toAddress.trim() === "") {
          setToAddress(cli.address || "");
        }
      }
      if (cli.currency_code && !quotation) {
        handleCurrencyChange(cli.currency_code);
      }
    }
  };

  // Instant currency conversion on change
  const handleCurrencyChange = (newCurr: string) => {
    const fromCurr = effectiveCurrency;
    const toCurr = newCurr.toUpperCase();
    setCurrencyCode(toCurr);

    if (fromCurr && toCurr && fromCurr !== toCurr) {
      const factor = getRate(fromCurr, toCurr, baseCurrency);
      if (factor > 0 && factor !== 1) {
        setItems((prev) =>
          prev.map((it) => {
            const currentRate = parseFloat(it.rate);
            const currentSupplierRate = parseFloat(it.supplier_rate ?? "0");
            const currentProfit = parseFloat(it.profit ?? "0");

            const convertedRate = !isNaN(currentRate) && currentRate > 0 ? (currentRate * factor).toFixed(2) : it.rate;
            const convertedSupplierRate = !isNaN(currentSupplierRate) && currentSupplierRate > 0 ? (currentSupplierRate * factor).toFixed(2) : it.supplier_rate;
            const convertedProfit = !isNaN(currentProfit) && currentProfit > 0 ? (currentProfit * factor).toFixed(2) : it.profit;

            return {
              ...it,
              rate: convertedRate,
              supplier_rate: convertedSupplierRate,
              profit: convertedProfit,
            };
          })
        );
        toast.success(
          `Converted items from ${fromCurr} to ${toCurr} (1 ${fromCurr} = ${factor < 0.01 ? factor.toFixed(6) : factor.toFixed(4)} ${toCurr}).`
        );
      }
    }
  };

  // Auto-select client or supplier if just created from a redirected form
  useEffect(() => {
    const justClient = consumeJustCreated("client");
    if (justClient) {
      apiFetch<Client>(`/api/clients/${justClient.id}/`)
        .then((c) => {
          setClients((prev) => (prev.some((x) => x.id === c.id) ? prev : [c, ...prev]));
          handleClientChange(Number(c.id));
          toast.success(`Client "${c.client_name}" selected.`);
        })
        .catch(() => {
          handleClientChange(Number(justClient.id));
        });
    }

    const justSupplier = consumeJustCreated("supplier");
    if (justSupplier) {
      apiFetch<Supplier>(`/api/suppliers/${justSupplier.id}/`)
        .then((s) => {
          setSuppliers((prev) => (prev.some((x) => x.id === s.id) ? prev : [s, ...prev]));
          setSupplierId(Number(s.id));
          toast.success(`Supplier "${s.supplier_name}" selected.`);
        })
        .catch(() => {
          setSupplierId(Number(justSupplier.id));
        });
    }
  }, []);

  // Two-way calculation logic matching Quotationsample.xlsx
  function handleItemChange(
    index: number,
    field: "description" | "qty" | "supplier_rate" | "margin_percent" | "profit" | "rate",
    value: string
  ) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const updated = { ...it, [field]: value };

        const qty = parseFloat(field === "qty" ? value : updated.qty) || 0;
        let sRate = parseFloat(field === "supplier_rate" ? value : updated.supplier_rate ?? "0") || 0;
        let marginPct = parseFloat(field === "margin_percent" ? value : updated.margin_percent ?? "0") || 0;
        let profit = parseFloat(field === "profit" ? value : updated.profit ?? "0") || 0;
        let clientRate = parseFloat(field === "rate" ? value : updated.rate ?? "0") || 0;

        if (field === "supplier_rate") {
          if (marginPct > 0) {
            profit = Number((sRate * (marginPct / 100)).toFixed(2));
            clientRate = Number((sRate + profit).toFixed(2));
          } else if (profit > 0) {
            clientRate = Number((sRate + profit).toFixed(2));
            marginPct = sRate > 0 ? Number(((profit / sRate) * 100).toFixed(2)) : 0;
          } else if (clientRate > 0) {
            profit = Number((clientRate - sRate).toFixed(2));
            marginPct = sRate > 0 ? Number(((profit / sRate) * 100).toFixed(2)) : 0;
          } else {
            clientRate = sRate;
          }
        } else if (field === "margin_percent") {
          profit = Number((sRate * (marginPct / 100)).toFixed(2));
          clientRate = Number((sRate + profit).toFixed(2));
        } else if (field === "profit") {
          clientRate = Number((sRate + profit).toFixed(2));
          marginPct = sRate > 0 ? Number(((profit / sRate) * 100).toFixed(2)) : 0;
        } else if (field === "rate") {
          profit = Number((clientRate - sRate).toFixed(2));
          marginPct = sRate > 0 ? Number(((profit / sRate) * 100).toFixed(2)) : 0;
        }

        const totalProfit = Number((qty * profit).toFixed(2));
        const amount = Number((qty * clientRate).toFixed(2));

        return {
          ...updated,
          qty: String(value !== "" && field === "qty" ? value : qty || ""),
          supplier_rate: String(value !== "" && field === "supplier_rate" ? value : sRate),
          margin_percent: String(value !== "" && field === "margin_percent" ? value : marginPct),
          profit: String(value !== "" && field === "profit" ? value : profit),
          rate: String(value !== "" && field === "rate" ? value : clientRate),
          total_profit: String(totalProfit),
          amount: String(amount),
        };
      })
    );
  }

  function updateItem(index: number, patch: Partial<QuotationItemDetail>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  const handleProductNameChange = (index: number, val: string) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const matchingProduct = products.find(
          (p) => p.product_name.toLowerCase() === val.trim().toLowerCase()
        );
        if (matchingProduct) {
          return {
            ...it,
            product: matchingProduct.id,
            product_name: matchingProduct.product_name,
            description: it.description || matchingProduct.description || "",
          };
        }
        return {
          ...it,
          product: null,
          product_name: val,
        };
      })
    );
  };

  const handleProductSelect = (index: number, product: Product | null) => {
    if (!product) {
      handleProductNameChange(index, "");
    } else {
      handleProductNameChange(index, product.product_name);
    }
  };

  function updateItemExtra(index: number, key: string, value: string) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, extra_data: { ...it.extra_data, [key]: value } } : it))
    );
  }

  function addColumn() {
    const col = { key: newColumnKey(), label: "New Column" };
    setColumns((prev) => [...prev, col]);
  }

  function removeColumn(key: string) {
    setColumns((prev) => prev.filter((c) => c.key !== key));
    setItems((prev) =>
      prev.map((it) => {
        const rest = { ...it.extra_data };
        delete rest[key];
        return { ...it, extra_data: rest };
      })
    );
  }

  // Financial aggregates
  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0), 0),
    [items]
  );

  const totalSupplierCost = useMemo(
    () =>
      items.reduce(
        (sum, it) => sum + (parseFloat(it.qty) || 0) * (parseFloat(it.supplier_rate ?? "0") || 0),
        0
      ),
    [items]
  );

  const totalProfit = useMemo(
    () =>
      items.reduce((sum, it) => {
        const q = parseFloat(it.qty) || 0;
        const p =
          parseFloat(it.profit ?? "0") ||
          (parseFloat(it.rate) || 0) - (parseFloat(it.supplier_rate ?? "0") || 0);
        return sum + q * p;
      }, 0),
    [items]
  );

  // Auto-generate WhatsApp message template matching Quotationsample.xlsx rows 12-24
  const defaultWhatsappMessage = useMemo(() => {
    const clientName = selectedClient?.client_name || toName || "Sir/Madam";
    const city = selectedCompany?.city || selectedClient?.address?.split(",")?.[0] || "Surat";
    const lines: string[] = [];
    lines.push("Dear.");
    lines.push(`*${clientName}*`);
    if (city) lines.push(city.trim());
    lines.push("");
    if (subject) {
      lines.push(`Quotation For : *${subject.trim()}*`);
      lines.push("");
    }

    items.forEach((it, idx) => {
      const prodName = it.product ? products.find((p) => p.id === it.product)?.product_name || it.product_name : it.product_name;
      const desc = it.description ? it.description.trim() : "";
      const itemTitle = prodName && desc ? `${prodName} (${desc})` : (prodName || desc || `Item ${idx + 1}`);
      const qty = it.qty || "1";
      const clientRate = it.rate || "0";
      lines.push(`*${itemTitle}*`);
      lines.push(`Qty. ${qty}`);
      lines.push(`Rs. ${clientRate}/- + GST`);
      lines.push("");
    });

    lines.push("Thank you... Thank you.... Very much...");
    return lines.join("\n");
  }, [selectedClient, toName, selectedCompany, subject, items]);

  useEffect(() => {
    if (!isWhatsappCustomized) {
      setWhatsappText(quotation?.whatsapp_message || defaultWhatsappMessage);
    }
  }, [defaultWhatsappMessage, isWhatsappCustomized, quotation?.whatsapp_message]);

  const handleSendWhatsapp = () => {
    const clean = whatsappPhone.replace(/[^0-9]/g, "");
    if (!clean) {
      toast.error("Please enter a valid WhatsApp mobile number.");
      return;
    }
    const phoneWithCountry = clean.length === 10 ? `91${clean}` : clean;
    const encoded = encodeURIComponent(whatsappText);
    const waUrl = `https://wa.me/${phoneWithCountry}?text=${encoded}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
    toast.success(`Opening WhatsApp chat with +${phoneWithCountry}...`);
  };

  const handleCopyWhatsapp = () => {
    if (!whatsappText) return;
    navigator.clipboard.writeText(whatsappText);
    setWhatsappCopied(true);
    toast.success("WhatsApp message copied to clipboard!");
    setTimeout(() => setWhatsappCopied(false), 2000);
  };

  const handleCompactWhatsappFormat = () => {
    const clientName = selectedClient?.client_name || toName || "Sir/Madam";
    const lines: string[] = [];
    lines.push(`*Quotation for ${clientName}*`);
    if (subject) lines.push(`_Subject: ${subject}_`);
    lines.push("");
    items.forEach((it) => {
      const desc = it.description ? it.description.trim() : "Product";
      lines.push(`*${desc}*:`);
      lines.push(`• ${it.qty || "0"} qty : Rs. ${it.rate || "0"}+gst`);
    });
    lines.push("");
    lines.push(`Thank you! — ${activeOrganization?.name || "Meewa Industries"}`);
    setWhatsappText(lines.join("\n"));
    setIsWhatsappCustomized(true);
    toast.success("Applied compact tier rate list format.");
  };

  function formatFileSize(bytes?: number | null): string {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleFilesSelected(fileList: FileList, includeInPdf: boolean = false) {
    const newFiles = Array.from(fileList);
    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        let fileType = "other";
        const name = file.name.toLowerCase();
        if (name.endsWith(".pdf") || file.type === "application/pdf") {
          fileType = "pdf";
        } else if (
          name.endsWith(".xlsx") ||
          name.endsWith(".xls") ||
          name.endsWith(".csv") ||
          file.type.includes("sheet") ||
          file.type.includes("excel") ||
          file.type.includes("csv")
        ) {
          fileType = "excel";
        } else if (
          name.endsWith(".png") ||
          name.endsWith(".jpg") ||
          name.endsWith(".jpeg") ||
          name.endsWith(".webp") ||
          name.endsWith(".svg") ||
          name.endsWith(".gif") ||
          file.type.startsWith("image/")
        ) {
          fileType = "image";
        }

        const baseTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
        const formattedTitle = baseTitle.charAt(0).toUpperCase() + baseTitle.slice(1);

        setAttachments((prev) => [
          ...prev,
          {
            file: base64Data,
            file_name: file.name,
            file_size: file.size,
            file_type: fileType,
            file_url: base64Data,
            include_in_pdf: includeInPdf,
            annexure_title: includeInPdf ? `Annexure: ${formattedTitle}` : "",
          },
        ]);
        toast.success(
          includeInPdf
            ? `Added "${file.name}" to Quotation PDF Annexures`
            : `Attached "${file.name}" to Admin Records`
        );
      };
      reader.readAsDataURL(file);
    });
  }

  function updateAttachmentTitle(attIdx: number, newTitle: string) {
    setAttachments((prev) =>
      prev.map((item, idx) => (idx === attIdx ? { ...item, annexure_title: newTitle } : item))
    );
  }

  function toggleAttachmentIncludeInPdf(attIdx: number, include: boolean) {
    setAttachments((prev) =>
      prev.map((item, idx) => {
        if (idx !== attIdx) return item;
        const currentTitle = item.annexure_title || "";
        const baseTitle = (item.file_name || "Document").replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
        const formattedTitle = baseTitle.charAt(0).toUpperCase() + baseTitle.slice(1);
        return {
          ...item,
          include_in_pdf: include,
          annexure_title: include && !currentTitle ? `Annexure: ${formattedTitle}` : currentTitle,
        };
      })
    );
  }

  function handleViewAttachment(att: QuotationAttachment) {
    setPreviewAttachment(att);
  }

  function handleDownloadAttachment(att: QuotationAttachment) {
    const url = att.file_url || (typeof att.file === "string" ? att.file : null);
    if (!url) return;
    const fullUrl = url.startsWith("data:") || url.startsWith("blob:") ? url : mediaUrl(url);
    if (!fullUrl) return;

    const a = document.createElement("a");
    a.href = fullUrl;
    a.download = att.file_name || "attachment";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleDeleteAttachment(index: number, att: QuotationAttachment) {
    if (att.id && quotation?.id) {
      try {
        await apiFetch(`/api/quotations/${quotation.id}/attachments/${att.id}/`, {
          method: "DELETE",
        });
      } catch {
        // Continue removing from local state
      }
    }
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    toast.success("Attachment removed.");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!client) {
      setError("Pick a client before saving.");
      toast.error("Pick a client before saving.");
      return;
    }

    setConfirmSaveOpen(true);
  }

  async function proceedSave() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        quotation_date: quotationDate,
        quote_format: quoteFormat,
        client,
        project: project || null,
        supplier: supplierId || null,
        to_name: toName,
        to_address: toAddress,
        subject,
        intro_text: introText,
        notes,
        footer_content: footerContent,
        whatsapp_message: whatsappText,
        admin_remarks: adminRemarks,
        attachments: attachments.map((att) => ({
          id: att.id,
          file: att.file || (att.file_url ? "__KEEP_EXISTING__" : null),
          file_name: att.file_name,
          file_size: att.file_size,
          file_type: att.file_type,
          include_in_pdf: Boolean(att.include_in_pdf),
          annexure_title: att.annexure_title || "",
        })),
        col_qty_label: (quoteFormat === "costing" ? colLabels.supplier_qty : colLabels.qty) || colQtyLabel || "Qty",
        col_rate_label: (quoteFormat === "costing" ? colLabels.client_rate : colLabels.rate) || colRateLabel || "Client Rate",
        col_labels: {
          ...colLabels,
          qty: colLabels.qty || colQtyLabel || "Qty",
          rate: colLabels.rate || colRateLabel || "Client Rate",
          supplier_qty: colLabels.supplier_qty || colQtyLabel || "Qty.",
          client_rate: colLabels.client_rate || colRateLabel || "Client Rate",
          show_subtotal: showSubtotalInPdf,
          show_profit: showProfitInPdf,
        },
        columns_config: columns,
        status,
        items: items.map((it) => ({
          product: it.product || null,
          product_name:
            it.product_name ||
            (it.product ? products.find((p) => p.id === it.product)?.product_name : "") ||
            "",
          description: it.description || "",
          qty: it.qty,
          rate: it.rate,
          supplier_rate: it.supplier_rate || "0",
          profit: it.profit || "0",
          margin_percent: it.margin_percent || "0",
          total_profit: it.total_profit || "0",
          image: it.image || null,
          extra_data: it.extra_data,
        })),
      };
      if (currencyCode) payload.currency_code = currencyCode;

      if (quotation) {
        await apiFetch<QuotationDetail>(`/api/quotations/${quotation.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        clearDraft();
        clearCreationOrigin();
        toast.success("Quotation updated.");
        const target = searchParams?.get("returnUrl") || searchParams?.get("from") || "/quotations";
        router.push(target);
        router.refresh();
      } else {
        await apiFetch<QuotationDetail>("/api/quotations/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        clearDraft();
        clearCreationOrigin();
        toast.success("Quotation created.");
        const target = searchParams?.get("returnUrl") || searchParams?.get("from") || "/quotations";
        router.push(target);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this quotation.");
      toast.error(e instanceof ApiError ? e.message : "Couldn't save this quotation.");
    } finally {
      setSaving(false);
      setConfirmSaveOpen(false);
    }
  }

  async function handleCopy() {
    if (!quotation) return;
    setCopying(true);
    try {
      const copy = await apiFetch<QuotationDetail>(`/api/quotations/${quotation.id}/copy/`, {
        method: "POST",
        body: JSON.stringify({ date: new Date().toISOString().slice(0, 10) }),
      });
      toast.success(`Copied to ${copy.quotation_no}.`);
      router.push("/quotations");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't duplicate this quotation.");
    } finally {
      setCopying(false);
    }
  }

  async function handleCreateOrder() {
    if (!quotation) return;
    setCreatingOrder(true);
    try {
      const order = await apiFetch<{ id: number; order_no: string }>(
        `/api/quotations/${quotation.id}/create-order/`,
        {
          method: "POST",
          body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), tax_percent: 0 }),
        }
      );
      toast.success(`Order ${order.order_no} created and quotation marked as Accepted (Won).`);
      router.push("/orders");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't create an order from this quotation.");
    } finally {
      setCreatingOrder(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {draftRestored && (
        <DraftBanner
          savedAt={draftSavedAt}
          onDismiss={dismissDraftBanner}
          onDiscard={handleDiscardDraft}
        />
      )}

      {/* Top Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink">
            {quotation ? `Edit Quotation ${quotation.quotation_no}` : "New Quotation"}
          </h1>
          <p className="text-xs text-ink-muted mt-0.5 max-w-xl">
            Configure client details, calculate supplier cost &amp; margin, and generate client WhatsApp proposals.
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-start sm:justify-end gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setImportModalOpen(true)}
            className="gap-1.5"
          >
            <FileUp className="h-4 w-4 text-primary-600" /> Import PDF / Excel
          </Button>
          {quotation && (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(`/quotations/${quotation.id}/print`)}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" /> Print / PDF
              </Button>
              <Button type="button" variant="secondary" onClick={handleCopy} loading={copying} className="gap-1.5">
                <Copy className="h-4 w-4" /> Copy Quote
              </Button>
              {can("orders", "add") && (
                <Button type="button" variant="secondary" onClick={handleCreateOrder} loading={creatingOrder} className="gap-1.5">
                  <Check className="h-4 w-4 text-success-700" /> Convert to Order
                </Button>
              )}
            </>
          )}
          <Button variant="primary" type="submit" loading={saving} className="px-5 shrink-0">
            Save Quotation
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-primary-100 bg-primary-50 p-3.5 text-xs font-semibold text-primary-700 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-primary-600 hover:text-primary-800 cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Quotation Header Information */}
      <Card className="flex flex-col gap-5 p-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-base font-bold text-ink">Quotation Information</h2>
            <p className="text-xs text-ink-muted mt-0.5">Basic client, company and quotation parameters</p>
          </div>
          {status && (
            <span className="rounded-md bg-surface-sunken px-2.5 py-1 text-xs font-semibold uppercase text-ink-muted border border-border">
              Status: <strong className="text-ink">{status}</strong>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Client" required>
            <Combobox
              value={client || null}
              onChange={(v) => handleClientChange(Number(v))}
              options={clientOptions}
              placeholder="Search or select client..."
              onAddNew={() => setQuickAddClientOpen(true)}
              addNewLabel="Add new client"
            />
          </Field>

          {companies.length > 0 && (
            <Field
              label="Auto-fill by Company (optional)"
              hint="Picking a company automatically populates recipient name and address"
            >
              <Combobox
                value={selectedCompanyId || null}
                onChange={(v) => handleCompanySelect(Number(v))}
                options={companyOptions}
                placeholder="Select company to auto-fill..."
              />
            </Field>
          )}

          <Field label="Quotation Date" required>
            <Input
              type="date"
              value={quotationDate}
              onChange={(e) => setQuotationDate(e.target.value)}
              required
            />
          </Field>

          <Field label="Currency" hint="Changing currency instantly converts line item rates.">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={effectiveCurrency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="max-w-[180px] font-mono font-bold"
              >
                <option value="INR">INR — Indian Rupee (₹)</option>
                <option value="AED">AED — UAE Dirham (AED)</option>
                <option value="USD">USD — US Dollar ($)</option>
                <option value="EUR">EUR — Euro (€)</option>
                <option value="GBP">GBP — British Pound (£)</option>
                <option value="SAR">SAR — Saudi Riyal (SAR)</option>
                <option value="QAR">QAR — Qatari Riyal</option>
                <option value="KWD">KWD — Kuwaiti Dinar</option>
                <option value="OMR">OMR — Omani Rial</option>
                <option value="BHD">BHD — Bahraini Dinar</option>
                <option value="CAD">CAD — Canadian Dollar</option>
                <option value="AUD">AUD — Australian Dollar</option>
                <option value="SGD">SGD — Singapore Dollar</option>
              </Select>
              {effectiveCurrency !== baseCurrency && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-1 rounded border border-primary-100">
                  <RefreshCw className="h-3 w-3 text-primary-600" />
                  1 {effectiveCurrency} = {getRate(effectiveCurrency, baseCurrency, baseCurrency).toFixed(4)} {baseCurrency}
                </span>
              )}
            </div>
          </Field>

          <Field label="Subject" className="sm:col-span-2">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Corrugated Box Order / Discount Coupon Card"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 pt-2 border-t border-border items-start">
          <Field label="To Name" hint="Client or Company Name on Quotation">
            <Input
              value={toName}
              onChange={(e) => setToName(e.target.value)}
              placeholder="e.g. Kalamandir Jewellers Ltd."
            />
          </Field>
          <Field label="To Address" hint="Company office or delivery location address">
            <Textarea
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              rows={2}
              placeholder="e.g. Corporate House, VIP Road, Surat, Gujarat"
            />
          </Field>

          {/* Client PDF Annexures / Attachments (Compact in Quotation Information) */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-sunken/40 p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary-600" />
                <span>PDF Annexures</span>
              </label>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded border border-primary-200">
                Appended to PDF
              </span>
            </div>

            {/* Compact Drag & Drop / Upload trigger */}
            <div
              onClick={() => pdfAnnexureFileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingAnnexure(true);
              }}
              onDragLeave={() => setIsDraggingAnnexure(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingAnnexure(false);
                if (e.dataTransfer.files?.length) {
                  handleFilesSelected(e.dataTransfer.files, true);
                }
              }}
              className={clsx(
                "flex items-center justify-center gap-2 px-3 py-2 border border-dashed rounded-md cursor-pointer transition-colors text-center text-xs font-semibold shadow-2xs",
                isDraggingAnnexure
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-border hover:border-primary-400 hover:bg-neutral-50 bg-white text-ink"
              )}
            >
              <input
                ref={pdfAnnexureFileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleFilesSelected(e.target.files, true);
                  }
                  e.target.value = "";
                }}
              />
              <FileUp className="h-3.5 w-3.5 text-primary-600 shrink-0" />
              <span>Attach PDF / Drawing</span>
            </div>

            {/* Attached Annexures List */}
            {(() => {
              const pdfAtts = attachments
                .map((att, actualIndex) => ({ att, actualIndex }))
                .filter(({ att }) => Boolean(att.include_in_pdf));

              if (pdfAtts.length === 0) {
                return (
                  <p className="text-[11px] text-ink-muted italic">
                    Optional: Attach drawings/specs to append to client PDF.
                  </p>
                );
              }

              return (
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {pdfAtts.map(({ att, actualIndex }) => {
                    const isImg = att.file_type === "image" || /\.(png|jpe?g|webp|gif|svg)$/i.test(att.file_name);
                    return (
                      <div
                        key={actualIndex}
                        className="flex items-center justify-between gap-2 p-1.5 rounded border border-border bg-white text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {isImg ? (
                            <ImageIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                          )}
                          <input
                            type="text"
                            value={att.annexure_title || att.file_name}
                            onChange={(e) => updateAttachmentTitle(actualIndex, e.target.value)}
                            placeholder="Annexure Title"
                            className="text-xs font-semibold text-ink px-1.5 py-0.5 rounded border border-border focus:border-primary-500 focus:outline-hidden flex-1 min-w-0 bg-neutral-50/50"
                            title={att.file_name}
                          />
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleViewAttachment(att)}
                            className="p-1 rounded hover:bg-neutral-100 text-primary-600 cursor-pointer"
                            title="Preview file"
                          >
                            <Eye className="h-3.5 w-3.5 shrink-0" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadAttachment(att)}
                            className="p-1 rounded hover:bg-neutral-100 text-ink-muted hover:text-ink cursor-pointer"
                            title="Download file"
                          >
                            <Download className="h-3.5 w-3.5 shrink-0" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setAttachmentToDelete({ index: actualIndex, att })}
                            className="p-1 rounded hover:bg-rose-50 text-rose-600 cursor-pointer"
                            title="Remove file"
                          >
                            <Trash2 className="h-3.5 w-3.5 shrink-0" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </Card>

      {/* Line Items Card with Dual Format Switcher */}
      <Card className="flex flex-col overflow-hidden">
        {/* Header Title & Format Switcher */}
        <div className="border-b border-border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <span>
                {quoteFormat === "standard"
                  ? "Line Items & Rates"
                  : "Supplier Costing & Profit Calculator"}
              </span>
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              {quoteFormat === "standard"
                ? "Standard direct client quote. Enter item description, quantity, and client selling rate directly."
                : "Internal margin calculator. Enter supplier cost and profit margin % or per-unit profit to derive Client Rate."}
            </p>
          </div>

          {/* Segmented Format Switcher Toggle */}
          <div className="inline-flex items-center rounded-lg border border-border bg-surface-sunken p-1 shadow-2xs shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setQuoteFormat("standard")}
              className={clsx(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer",
                quoteFormat === "standard"
                  ? "bg-surface text-ink shadow-2xs border border-border font-bold text-primary-700"
                  : "text-ink-muted hover:text-ink"
              )}
              title="Switch to Standard Direct Rate format (Description, Qty, Rate, Amount)"
            >
              <FileText className="h-3.5 w-3.5 text-primary-600" />
              <span>Standard Quote</span>
            </button>
            <button
              type="button"
              onClick={() => setQuoteFormat("costing")}
              className={clsx(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer",
                quoteFormat === "costing"
                  ? "bg-surface text-ink shadow-2xs border border-border font-bold text-success-700"
                  : "text-ink-muted hover:text-ink"
              )}
              title="Switch to Costing & Margin Calculator format (Supplier Cost, Margin %, Client Rate, Profit)"
            >
              <Calculator className="h-3.5 w-3.5 text-success-600" />
              <span>Costing &amp; Margin</span>
            </button>
          </div>
        </div>

        {/* Toolbar Strip: Client, Supplier & Spec Column Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-sunken/40 px-5 py-2.5 text-xs font-medium">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 shadow-2xs">
              <span className="text-ink-muted">Client:</span>
              <strong className="text-ink">{selectedClient?.client_name || toName || "Client"}</strong>
            </div>

            {quoteFormat === "costing" && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink-muted whitespace-nowrap">Supplier:</span>
                <div className="w-64 sm:w-80 flex items-center gap-1.5">
                  <div className="flex-1">
                    <Combobox
                      value={supplierId || null}
                      onChange={(v) => setSupplierId(v ? Number(v) : "")}
                      options={supplierOptions}
                      placeholder="Search or select supplier..."
                      onAddNew={() => setQuickAddSupplierOpen(true)}
                      addNewLabel="Add new supplier"
                    />
                  </div>
                  {supplierId ? (
                    <button
                      type="button"
                      onClick={() => setSupplierId("")}
                      className="p-2 rounded-md text-ink-faint hover:text-primary-600 hover:bg-surface transition-colors cursor-pointer border border-border"
                      title="Clear supplier"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={addColumn}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline cursor-pointer flex items-center gap-1 shrink-0 ml-auto"
          >
            <Plus className="h-3.5 w-3.5" /> Add Spec Column
          </button>
        </div>

        {/* Dynamic Table: Standard Direct Rate vs Multi-Tier Costing */}
        {quoteFormat === "standard" ? (
          /* Format 1: Standard Direct Quotation Table (The Classic Format) */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-sunken/60 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  <th className="w-12 px-3 py-2.5 text-center border-r border-border">Sr. No.</th>
                  <th className="min-w-[280px] sm:min-w-[340px] px-4 py-2.5 text-left border-r border-border">
                    <input
                      value={colLabels.item ?? "Item & Description"}
                      onChange={(e) => updateColLabel("item", e.target.value)}
                      className="w-48 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-[11px] font-bold text-ink uppercase focus:border-primary-500 focus:outline-none"
                      title="Click to edit column header"
                    />
                  </th>
                  <th className="w-24 px-2 py-2.5 text-center border-r border-border">
                    <input
                      value={colLabels.reference ?? "Reference"}
                      onChange={(e) => updateColLabel("reference", e.target.value)}
                      className="w-20 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-center text-[11px] font-bold text-ink uppercase focus:border-primary-500 focus:outline-none"
                      title="Click to edit column header"
                    />
                  </th>
                  {columns.map((col) => (
                    <th key={col.key} className="w-28 px-3 py-2.5 text-left border-r border-border">
                      <div className="flex items-center gap-1">
                        <input
                          value={col.label}
                          onChange={(e) =>
                            setColumns((prev) =>
                              prev.map((c) => (c.key === col.key ? { ...c, label: e.target.value } : c))
                            )
                          }
                          className="w-20 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-[11px] font-bold text-ink uppercase focus:border-primary-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeColumn(col.key)}
                          className="text-ink-faint hover:text-primary-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="w-28 px-3 py-2.5 text-right border-r border-border">
                    <input
                      value={colLabels.qty ?? colQtyLabel}
                      onChange={(e) => {
                        updateColLabel("qty", e.target.value);
                        setColQtyLabel(e.target.value);
                      }}
                      className="w-20 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-right text-[11px] font-bold text-ink uppercase focus:border-primary-500 focus:outline-none"
                      title="Click to edit column header"
                    />
                  </th>
                  <th className="w-28 px-3 py-2.5 text-right border-r border-border">
                    <input
                      value={colLabels.rate ?? colRateLabel}
                      onChange={(e) => {
                        updateColLabel("rate", e.target.value);
                        setColRateLabel(e.target.value);
                      }}
                      className="w-24 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-right text-[11px] font-bold text-ink uppercase focus:border-primary-500 focus:outline-none"
                      title="Click to edit column header"
                    />
                  </th>
                  <th className="w-32 px-3 py-2.5 text-right border-r border-border font-bold text-ink">
                    <input
                      value={colLabels.amount ?? "Amount"}
                      onChange={(e) => updateColLabel("amount", e.target.value)}
                      className="w-20 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-right text-[11px] font-bold text-ink uppercase focus:border-primary-500 focus:outline-none"
                      title="Click to edit column header"
                    />
                  </th>
                  <th className="w-10 px-2 py-2.5 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const q = parseFloat(it.qty) || 0;
                  const r = parseFloat(it.rate) || 0;
                  const amount = q * r;
                  const displayImg = it.image
                    ? it.image.startsWith("data:")
                      ? it.image
                      : mediaUrl(it.image) || it.image
                    : null;

                  return (
                    <tr key={i} className="border-b border-border hover:bg-surface-hover transition-colors">
                      <td className="px-3 py-2 text-center font-bold text-ink-muted border-r border-border">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2 border-r border-border">
                        <InlineItemCell
                          item={it}
                          index={i}
                          products={products}
                          datalistId={`standard-product-datalist-${i}`}
                          onProductNameChange={handleProductNameChange}
                          onDescriptionChange={(idx, val) => handleItemChange(idx, "description", val)}
                          onOpenProductModal={(idx) => {
                            setActiveProductRowIndex(idx);
                            setProductModalOpen(true);
                          }}
                        />
                      </td>
                      {/* Reference Image */}
                      <td className="px-2 py-2 text-center align-middle border-r border-border">
                        {displayImg ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPreviewLightboxImage(displayImg)}
                              className="relative group h-8 w-8 rounded-md border border-border overflow-hidden bg-surface p-0.5 shadow-2xs hover:border-primary-400 cursor-pointer"
                              title="Click to preview image"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={displayImg} alt="Reference" className="h-full w-full object-contain" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                <ZoomIn className="h-3 w-3 text-white" />
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItem(i, { image: null })}
                              className="text-ink-faint hover:text-primary-600 cursor-pointer"
                              title="Remove image"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-muted hover:text-primary-600 cursor-pointer bg-surface px-2 py-1 rounded border border-border hover:border-primary-300 transition shadow-2xs">
                            <Upload className="h-3 w-3" />
                            <span>+ Img</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (evt) => {
                                    if (evt.target?.result) {
                                      updateItem(i, { image: String(evt.target.result) });
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                      </td>
                      {columns.map((col) => (
                        <td key={col.key} className="px-2 py-2 border-r border-border">
                          <Input
                            value={it.extra_data[col.key] ?? ""}
                            onChange={(e) => updateItemExtra(i, col.key, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2 border-r border-border">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.qty}
                          onChange={(e) => handleItemChange(i, "qty", e.target.value)}
                          className="text-right font-medium"
                        />
                      </td>
                      <td className="px-2 py-2 border-r border-border">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.rate}
                          onChange={(e) => handleItemChange(i, "rate", e.target.value)}
                          className="text-right font-bold text-ink"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-ink tnum border-r border-border">
                        {formatCurrency(amount, effectiveCurrency)}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setItemToDelete({
                              index: i,
                              name: it.product_name || it.description || `Item #${i + 1}`,
                            })
                          }
                          disabled={items.length === 1}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-primary-50 hover:text-primary-600 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed mx-auto"
                          title="Remove row"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Format 2: Multi-Tier Supplier Costing & Margin Table (The New Format) */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                {/* Tier 1 Header */}
                <tr className="border-b border-border bg-surface-sunken/60 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  <th rowSpan={2} className="w-12 px-3 py-2 text-center border-r border-border">
                    Sr. No.
                  </th>
                  <th rowSpan={2} className="min-w-[280px] sm:min-w-[340px] px-4 py-2 text-left border-r border-border">
                    <input
                      value={colLabels.item ?? "Item & Description"}
                      onChange={(e) => updateColLabel("item", e.target.value)}
                      className="w-48 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-[11px] font-bold text-ink uppercase focus:border-primary-500 focus:outline-none"
                      title="Click to edit column header"
                    />
                  </th>
                  <th rowSpan={2} className="w-24 px-2 py-2 text-center border-r border-border">
                    <input
                      value={colLabels.reference ?? "Reference"}
                      onChange={(e) => updateColLabel("reference", e.target.value)}
                      className="w-20 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-center text-[11px] font-bold text-ink uppercase focus:border-primary-500 focus:outline-none"
                      title="Click to edit column header"
                    />
                  </th>
                  {columns.map((col) => (
                    <th key={col.key} rowSpan={2} className="w-28 px-3 py-2 text-left border-r border-border">
                      <div className="flex items-center gap-1">
                        <input
                          value={col.label}
                          onChange={(e) =>
                            setColumns((prev) =>
                              prev.map((c) => (c.key === col.key ? { ...c, label: e.target.value } : c))
                            )
                          }
                          className="w-20 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-[11px] font-bold text-ink uppercase focus:border-primary-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeColumn(col.key)}
                          className="text-ink-faint hover:text-primary-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </th>
                  ))}
                  {/* Spanning Header: Supplier Qty & Rate */}
                  <th
                    colSpan={2}
                    className="px-3 py-1.5 text-center border-r border-border bg-surface-sunken font-bold text-ink"
                  >
                    <input
                      value={colLabels.supplier_group ?? "Supplier Qty & Rate"}
                      onChange={(e) => updateColLabel("supplier_group", e.target.value)}
                      className="w-full text-center border-b border-dashed border-border-strong bg-transparent pb-0.5 text-[11px] font-bold text-ink focus:border-primary-500 focus:outline-none"
                      title="Click to edit group header"
                    />
                  </th>
                  {/* Spanning Header: Client Given Rate */}
                  <th
                    colSpan={4}
                    className="px-3 py-1.5 text-center border-r border-border bg-surface-sunken font-bold text-ink"
                  >
                    <input
                      value={colLabels.client_group ?? "Client Given Rate (Profit Calculation)"}
                      onChange={(e) => updateColLabel("client_group", e.target.value)}
                      className="w-full text-center border-b border-dashed border-border-strong bg-transparent pb-0.5 text-[11px] font-bold text-ink focus:border-primary-500 focus:outline-none"
                      title="Click to edit group header"
                    />
                  </th>
                  <th rowSpan={2} className="w-10 px-2 py-2 text-center"></th>
                </tr>

                {/* Tier 2 Sub-Headers */}
                <tr className="border-b border-border bg-surface-sunken/30 text-[10.5px] font-bold uppercase tracking-wider text-ink-muted">
                  {/* Supplier Columns */}
                  <th className="w-24 px-2 py-1.5 text-right border-r border-border">
                    <input
                      value={colLabels.supplier_qty ?? "Qty."}
                      onChange={(e) => {
                        updateColLabel("supplier_qty", e.target.value);
                        setColQtyLabel(e.target.value);
                      }}
                      className="w-20 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-right text-[10.5px] font-bold text-ink uppercase focus:border-primary-500 focus:outline-none"
                      title="Click to edit column name"
                    />
                  </th>
                  <th className="w-28 px-2 py-1.5 text-right border-r border-border font-bold text-ink">
                    <input
                      value={colLabels.supplier_rate ?? "Rate"}
                      onChange={(e) => updateColLabel("supplier_rate", e.target.value)}
                      className="w-20 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-right text-[10.5px] font-bold text-ink uppercase focus:border-primary-500 focus:outline-none"
                      title="Click to edit column name"
                    />
                  </th>
                  {/* Client Profit & Margin Columns */}
                  <th className="w-24 px-2 py-1.5 text-right border-r border-border font-bold text-ink">
                    <input
                      value={colLabels.margin_percent ?? "Add %"}
                      onChange={(e) => updateColLabel("margin_percent", e.target.value)}
                      className="w-20 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-right text-[10.5px] font-bold text-ink uppercase focus:border-primary-500 focus:outline-none"
                      title="Click to edit column name"
                    />
                  </th>
                  <th className="w-24 px-2 py-1.5 text-right border-r border-border font-bold text-ink">
                    <input
                      value={colLabels.profit ?? "Profit"}
                      onChange={(e) => updateColLabel("profit", e.target.value)}
                      className="w-20 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-right text-[10.5px] font-bold text-ink uppercase focus:border-primary-500 focus:outline-none"
                      title="Click to edit column name"
                    />
                  </th>
                  <th className="w-28 px-2 py-1.5 text-right border-r border-border font-bold text-ink">
                    <input
                      value={colLabels.client_rate ?? "Client Rate"}
                      onChange={(e) => {
                        updateColLabel("client_rate", e.target.value);
                        setColRateLabel(e.target.value);
                      }}
                      className="w-24 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-right text-[10.5px] font-bold text-ink uppercase focus:border-primary-500 focus:outline-none"
                      title="Click to edit column name"
                    />
                  </th>
                  <th className="w-32 px-2 py-1.5 text-right border-r border-border font-bold text-success-700">
                    <div className="flex items-center justify-end gap-1.5">
                      <label
                        className="flex items-center gap-1 cursor-pointer select-none"
                        title="Include Total Profit column in PDF / Printout"
                      >
                        <input
                          type="checkbox"
                          checked={showProfitInPdf}
                          onChange={(e) => setShowProfitInPdf(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </label>
                      <input
                        value={colLabels.total_profit ?? "Total Profit"}
                        onChange={(e) => updateColLabel("total_profit", e.target.value)}
                        className="w-20 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-right text-[10.5px] font-bold text-success-700 uppercase focus:border-primary-500 focus:outline-none"
                        title="Click to edit column name (Checkbox controls whether this column appears on PDF)"
                      />
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((it, i) => {
                  const displayImg = it.image
                    ? it.image.startsWith("data:")
                      ? it.image
                      : mediaUrl(it.image) || it.image
                    : null;

                  const rowProfit = parseFloat(it.total_profit ?? "0") || 0;

                  return (
                    <tr key={i} className="border-b border-border hover:bg-surface-hover transition-colors">
                      {/* Sr. No. */}
                      <td className="px-3 py-2 text-center font-bold text-ink-muted border-r border-border">
                        {i + 1}
                      </td>

                      {/* Product / Description with Product suggestions */}
                      <td className="px-3 py-2 border-r border-border">
                        <InlineItemCell
                          item={it}
                          index={i}
                          products={products}
                          datalistId={`costing-product-datalist-${i}`}
                          onProductNameChange={handleProductNameChange}
                          onDescriptionChange={(idx, val) => handleItemChange(idx, "description", val)}
                          onOpenProductModal={(idx) => {
                            setActiveProductRowIndex(idx);
                            setProductModalOpen(true);
                          }}
                        />
                      </td>

                      {/* Reference Image */}
                      <td className="px-2 py-2 text-center align-middle border-r border-border">
                        {displayImg ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPreviewLightboxImage(displayImg)}
                              className="relative group h-8 w-8 rounded-md border border-border overflow-hidden bg-surface p-0.5 shadow-2xs hover:border-primary-400 cursor-pointer"
                              title="Click to preview image"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={displayImg} alt="Reference" className="h-full w-full object-contain" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                <ZoomIn className="h-3 w-3 text-white" />
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItem(i, { image: null })}
                              className="text-ink-faint hover:text-primary-600 cursor-pointer"
                              title="Remove image"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-muted hover:text-primary-600 cursor-pointer bg-surface px-2 py-1 rounded border border-border hover:border-primary-300 transition shadow-2xs">
                            <Upload className="h-3 w-3" />
                            <span>+ Img</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (evt) => {
                                    if (evt.target?.result) {
                                      updateItem(i, { image: String(evt.target.result) });
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                      </td>

                      {/* Custom Columns */}
                      {columns.map((col) => (
                        <td key={col.key} className="px-2 py-2 border-r border-border">
                          <Input
                            value={it.extra_data[col.key] ?? ""}
                            onChange={(e) => updateItemExtra(i, col.key, e.target.value)}
                          />
                        </td>
                      ))}

                      {/* Supplier Qty */}
                      <td className="px-2 py-2 border-r border-border">
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          value={it.qty}
                          onChange={(e) => handleItemChange(i, "qty", e.target.value)}
                          className="text-right font-medium"
                        />
                      </td>

                      {/* Supplier Rate */}
                      <td className="px-2 py-2 border-r border-border">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.supplier_rate ?? "0"}
                          onChange={(e) => handleItemChange(i, "supplier_rate", e.target.value)}
                          className="text-right font-medium"
                          placeholder="0.00"
                        />
                      </td>

                      {/* Add as % */}
                      <td className="px-2 py-2 border-r border-border">
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.1"
                            value={it.margin_percent ?? ""}
                            onChange={(e) => handleItemChange(i, "margin_percent", e.target.value)}
                            placeholder="25"
                            className="text-right pr-5 font-medium"
                          />
                          <span className="absolute right-2 top-2 text-[10px] font-bold text-ink-muted pointer-events-none">
                            %
                          </span>
                        </div>
                      </td>

                      {/* Profit per unit */}
                      <td className="px-2 py-2 border-r border-border">
                        <Input
                          type="number"
                          step="0.01"
                          value={it.profit ?? "0"}
                          onChange={(e) => handleItemChange(i, "profit", e.target.value)}
                          className="text-right font-medium text-ink"
                          placeholder="0.00"
                        />
                      </td>

                      {/* Client Rate */}
                      <td className="px-2 py-2 border-r border-border">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.rate}
                          onChange={(e) => handleItemChange(i, "rate", e.target.value)}
                          className="text-right font-bold text-ink"
                          placeholder="0.00"
                        />
                      </td>

                      {/* Total Profit */}
                      <td className="px-3 py-2 text-right font-bold border-r border-border">
                        <span className="inline-block text-success-700 font-mono tnum">
                          {formatCurrency(rowProfit, effectiveCurrency)}
                        </span>
                      </td>

                      {/* Delete action */}
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setItemToDelete({
                              index: i,
                              name: it.product_name || it.description || `Item #${i + 1}`,
                            })
                          }
                          disabled={items.length === 1}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-primary-50 hover:text-primary-600 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed mx-auto"
                          title="Remove row"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Section 1 Footer Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-border px-5 py-3 gap-3 bg-surface-sunken/40">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, blankItem()])}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 cursor-pointer w-fit"
            >
              <Plus className="h-4 w-4" /> {quoteFormat === "standard" ? "Add Line Item" : "Add Item / Tier Row"}
            </button>
          </div>

          {/* Financial Totals + Inline Save Button */}
          <div className="flex flex-wrap items-center gap-3 text-xs sm:justify-end">
            {quoteFormat === "costing" && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-ink-muted">Supplier Cost:</span>
                  <strong className="font-bold text-ink tnum">{formatCurrency(totalSupplierCost, effectiveCurrency)}</strong>
                </div>

                <label
                  title="Toggle whether Total Profit column & Net Profit appear on quotation PDF"
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 transition-all cursor-pointer select-none ${
                    showProfitInPdf
                      ? "border-emerald-300 bg-emerald-50/70 text-emerald-900 shadow-2xs"
                      : "border-border bg-surface text-ink hover:bg-surface-hover shadow-2xs"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={showProfitInPdf}
                    onChange={(e) => setShowProfitInPdf(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-ink-muted">Net Profit:</span>
                  <strong className="font-bold text-success-700 tnum">{formatCurrency(totalProfit, effectiveCurrency)}</strong>
                  <span
                    className={`text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      showProfitInPdf ? "bg-emerald-600 text-white" : "bg-neutral-100 text-neutral-500 border border-neutral-200"
                    }`}
                  >
                    PDF: {showProfitInPdf ? "ON" : "OFF"}
                  </span>
                </label>
              </>
            )}

            <label
              title="Toggle whether Subtotal appears on quotation PDF"
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 transition-all cursor-pointer select-none ${
                showSubtotalInPdf
                  ? "border-primary-300 bg-primary-50/60 text-primary-900 shadow-2xs"
                  : "border-border bg-surface text-ink hover:bg-surface-hover shadow-2xs"
              }`}
            >
              <input
                type="checkbox"
                checked={showSubtotalInPdf}
                onChange={(e) => setShowSubtotalInPdf(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border text-primary-600 focus:ring-primary-500 cursor-pointer"
              />
              <span className="text-ink-muted">{quoteFormat === "standard" ? "Subtotal:" : "Client Subtotal:"}</span>
              <strong className="font-extrabold text-primary-600 text-sm tnum">
                {formatCurrency(subtotal, effectiveCurrency)}
              </strong>
              <span
                className={`text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  showSubtotalInPdf ? "bg-primary-600 text-white" : "bg-neutral-100 text-neutral-500 border border-neutral-200"
                }`}
              >
                PDF: {showSubtotalInPdf ? "ON" : "OFF"}
              </span>
            </label>

            {effectiveCurrency !== baseCurrency && (
              <span className="text-ink-muted text-[11px]">
                ≈ <strong className="font-mono text-ink">{formatCurrency(subtotal * getRate(effectiveCurrency, baseCurrency, baseCurrency), baseCurrency)}</strong>
              </span>
            )}

            <Button
              variant="primary"
              type="submit"
              loading={saving}
              className="gap-1.5 px-4 h-8.5 text-xs font-bold shrink-0 shadow-2xs ml-auto sm:ml-2"
            >
              <Check className="h-3.5 w-3.5" /> Save Quotation
            </Button>
          </div>
        </div>
      </Card>

      {/* Section 2: WhatsApp Proposal & Admin Remarks (Side-by-Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* WhatsApp Proposal Card */}
        <Card className="flex flex-col justify-between gap-4 p-5 h-full">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-3 gap-3">
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary-600" />
                  WhatsApp Proposal
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Formatted from Section 1 rates. Click &apos;Send on WhatsApp&apos; to dispatch directly to client.
                </p>
              </div>

              {/* Quick Actions & Formatting controls */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCompactWhatsappFormat}
                >
                  Tier List Format
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setWhatsappText(defaultWhatsappMessage);
                    setIsWhatsappCustomized(false);
                    toast.success("Reset to auto-generated proposal template.");
                  }}
                  className="gap-1"
                >
                  <RotateCcw className="h-3 w-3" /> Reset Template
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyWhatsapp}
                  className="gap-1"
                >
                  {whatsappCopied ? <Check className="h-3.5 w-3.5 text-success-700" /> : <Copy className="h-3.5 w-3.5" />}
                  {whatsappCopied ? "Copied!" : "Copy Text"}
                </Button>
              </div>
            </div>

            {/* WhatsApp Phone & Send Button Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-surface-sunken/40 p-3">
              <div className="flex items-center gap-2.5 flex-1 max-w-md">
                <span className="text-xs font-semibold text-ink whitespace-nowrap">
                  Recipient WhatsApp No :
                </span>
                <Input
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="e.g. 9978644533 or +91 9978644533"
                  className="font-mono text-xs"
                />
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSendWhatsapp}
                className="gap-2"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send on WhatsApp</span>
                <ExternalLink className="h-3 w-3 opacity-80" />
              </Button>
            </div>

            {/* Message Preview */}
            <div>
              <div className="flex items-center justify-between pb-1.5">
                <label className="text-xs font-semibold text-ink">
                  Message Preview (Editable Before Sending)
                </label>
                <span className="text-[11px] text-ink-muted">
                  Supports WhatsApp bold (*text*), italic (_text_), and line breaks
                </span>
              </div>
              <Textarea
                value={whatsappText}
                onChange={(e) => {
                  setWhatsappText(e.target.value);
                  setIsWhatsappCustomized(true);
                }}
                rows={7}
                className="font-mono text-xs leading-relaxed"
              />
            </div>
          </div>
        </Card>

        {/* Admin Remarks & Internal Records Card */}
        <Card className="flex flex-col justify-between gap-4 p-5 h-full">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-3 gap-2">
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary-600" />
                  Admin Remarks &amp; Internal Records
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Internal notes &amp; media for admin records (never printed on client quotation).
                </p>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wider self-start sm:self-auto">
                Admin Record
              </span>
            </div>

            {/* Remark Textarea */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink flex items-center justify-between">
                <span>Internal Remarks / Notes</span>
                <span className="text-[11px] font-normal text-ink-muted">Admin &amp; staff reference only</span>
              </label>
              <Textarea
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
                placeholder="Enter internal notes, client negotiation history, sample approvals, supplier terms..."
                rows={3}
                className="text-xs leading-relaxed"
              />
            </div>

            {/* Uploaded Media & Attachments Section */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-primary-600" />
                  Attached Media &amp; Files
                </label>
                <span className="text-[11px] text-ink-muted">Images, PDF, Excel (XLSX, XLS, CSV)</span>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.length) {
                    handleFilesSelected(e.dataTransfer.files);
                  }
                }}
                className={clsx(
                  "flex flex-col items-center justify-center p-3.5 border-2 border-dashed rounded-lg cursor-pointer transition-colors text-center",
                  isDragging
                    ? "border-primary-500 bg-primary-50/60"
                    : "border-border hover:border-primary-400 hover:bg-neutral-50/80 bg-surface-sunken/30"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      handleFilesSelected(e.target.files);
                    }
                    e.target.value = "";
                  }}
                />
                <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                  <FileUp className="h-4 w-4 text-primary-600" />
                  <span>Click or drag files here to upload</span>
                </div>
                <p className="text-[11px] text-ink-muted mt-0.5">
                  Supports Images (PNG, JPG, WebP), PDF, and Excel spreadsheets
                </p>
              </div>

              {/* Uploaded Attachments List (Shows all files: both internal and PDF annexures) */}
              {attachments.length === 0 ? (
                <p className="text-[11.5px] text-ink-muted italic pt-0.5">
                  No files or media uploaded yet.
                </p>
              ) : (
                <div className="mt-1 space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {attachments.map((att, actualIndex) => {
                    const isImg = att.file_type === "image" || /\.(png|jpe?g|webp|gif|svg)$/i.test(att.file_name);
                    const isPdf = att.file_type === "pdf" || /\.pdf$/i.test(att.file_name);
                    return (
                      <div
                        key={actualIndex}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-surface shadow-2xs hover:border-primary-200 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {isImg ? (
                            <div className="h-8 w-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                              <ImageIcon className="h-4 w-4" />
                            </div>
                          ) : isPdf ? (
                            <div className="h-8 w-8 rounded bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                              <FileText className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className="h-8 w-8 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                              <FileSpreadsheet className="h-4 w-4" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-semibold text-ink truncate max-w-[240px]" title={att.file_name}>
                                {att.file_name}
                              </p>
                              {att.include_in_pdf ? (
                                <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[10.5px] font-bold text-rose-700 border border-rose-200 shrink-0">
                                  <FileText className="h-3 w-3 shrink-0" />
                                  <span>Attached to PDF</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5 text-[10.5px] font-semibold text-neutral-600 border border-neutral-200 shrink-0">
                                  <ShieldCheck className="h-3 w-3 shrink-0" />
                                  <span>Internal Only</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-ink-muted mt-0.5">
                              {formatFileSize(att.file_size)}
                              {att.file_type && ` • ${att.file_type.toUpperCase()}`}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {(isPdf || isImg) && (
                            <button
                              type="button"
                              onClick={() => toggleAttachmentIncludeInPdf(actualIndex, !att.include_in_pdf)}
                              className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer shadow-2xs shrink-0 ${
                                att.include_in_pdf
                                  ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                  : "border-border bg-white text-ink-muted hover:text-primary-700 hover:border-primary-300 hover:bg-primary-50/50"
                              }`}
                              title={att.include_in_pdf ? "Click to remove from client PDF" : "Click to attach to client PDF"}
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              <span>{att.include_in_pdf ? "PDF: ON" : "+ PDF"}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleViewAttachment(att)}
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 hover:border-primary-300 text-xs font-bold transition-colors cursor-pointer shadow-2xs shrink-0"
                            title="View / Preview File"
                          >
                            <Eye className="h-3.5 w-3.5 text-primary-600 shrink-0" />
                            <span>View</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadAttachment(att)}
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-white text-ink-muted hover:text-ink hover:bg-neutral-50 hover:border-neutral-300 text-xs font-semibold transition-colors cursor-pointer shadow-2xs shrink-0"
                            title="Download file"
                          >
                            <Download className="h-3.5 w-3.5 shrink-0" />
                            <span className="hidden sm:inline">Download</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAttachmentToDelete({ index: actualIndex, att })}
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-300 text-xs font-semibold transition-colors cursor-pointer shadow-2xs shrink-0"
                            title="Delete file"
                          >
                            <Trash2 className="h-3.5 w-3.5 shrink-0" />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Document Terms & Print Notes Card */}
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 className="text-base font-bold text-ink">Document Terms &amp; Print Notes</h2>
            <p className="text-xs text-ink-muted mt-0.5">Formal introduction and conditions for printed PDF</p>
          </div>
          {appSettings && (appSettings.quotation_intro || appSettings.quotation_terms) && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                if (appSettings.quotation_intro) setIntroText(appSettings.quotation_intro);
                if (appSettings.quotation_terms) setNotes(appSettings.quotation_terms);
                toast.success("Applied global quotation settings defaults.");
              }}
              className="gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Apply Global Settings Defaults
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Introductory Text" hint="Appears before line items table on formal PDF">
            <Textarea
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              rows={3}
              placeholder="Dear Customer, thank you for the opportunity to quote..."
            />
          </Field>
          <Field label="Terms &amp; Conditions / Notes" hint="Numbered bullet points on PDF">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </Field>
        </div>
      </Card>

      {/* Activity Timeline if editing */}
      {quotation?.id && (
        <ActivityTimeline
          endpoint={`/api/quotations/${quotation.id}/timeline/`}
          refreshTrigger={saving}
          title="Quotation History &amp; Activity Timeline"
        />
      )}

      {error && <p className="text-[13px] font-medium text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-200">{error}</p>}

      {/* Bottom Page Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 pb-8 border-t border-border">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/quotations")}
        >
          Cancel
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {quotation && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/quotations/${quotation.id}/print`)}
              className="gap-1.5"
            >
              <Printer className="h-4 w-4" /> Print / PDF
            </Button>
          )}
          <Button variant="primary" type="submit" loading={saving} className="px-6 gap-1.5 shadow-sm font-bold">
            <Check className="h-4 w-4" /> Save Quotation
          </Button>
        </div>
      </div>

      {/* SlideOver for fast-track Add Client */}
      <SlideOver
        open={quickAddClientOpen}
        onClose={() => setQuickAddClientOpen(false)}
        title="Add New Client"
        size="lg"
      >
        <ClientForm
          client={null}
          countries={countries}
          onCancel={() => setQuickAddClientOpen(false)}
          onSaved={(savedClient) => {
            setQuickAddClientOpen(false);
            if (savedClient) {
              setClients((prev) => [savedClient, ...prev]);
              handleClientChange(savedClient.id);
            } else {
              reloadClients();
            }
          }}
        />
      </SlideOver>

      {/* SlideOver for fast-track Add Supplier */}
      <SlideOver
        open={quickAddSupplierOpen}
        onClose={() => setQuickAddSupplierOpen(false)}
        title="Add New Supplier"
        size="lg"
      >
        <SupplierForm
          supplier={null}
          onCancel={() => setQuickAddSupplierOpen(false)}
          onSaved={(savedSupplier) => {
            setQuickAddSupplierOpen(false);
            if (savedSupplier) {
              setSuppliers((prev) => [savedSupplier, ...prev]);
              setSupplierId(savedSupplier.id);
            } else {
              reloadSuppliers();
            }
          }}
        />
      </SlideOver>

      {/* Image Lightbox Modal */}
      <ImageLightboxModal
        open={Boolean(previewLightboxImage)}
        onClose={() => setPreviewLightboxImage(null)}
        images={previewLightboxImage ? [{ image: previewLightboxImage }] : []}
      />

      {/* Attachment Viewer Modal (PDF, Excel, Images) */}
      <AttachmentViewerModal
        open={Boolean(previewAttachment)}
        onClose={() => setPreviewAttachment(null)}
        attachment={previewAttachment}
      />

      {/* PDF & Excel Import Modal */}
      <QuotationImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportSuccess={applyImportedData}
        clients={clients}
        suppliers={suppliers}
        onQuickAddClient={() => setQuickAddClientOpen(true)}
        onQuickAddSupplier={() => setQuickAddSupplierOpen(true)}
      />

      {/* Quick Add Product Modal */}
      <ProductModal
        open={productModalOpen}
        onClose={() => {
          setProductModalOpen(false);
          setActiveProductRowIndex(null);
        }}
        onSaved={(newProduct) => {
          reloadProducts();
          if (activeProductRowIndex !== null) {
            handleProductSelect(activeProductRowIndex, newProduct);
          }
          setProductModalOpen(false);
          setActiveProductRowIndex(null);
        }}
      />

      {/* Confirm Save / Update Dialog */}
      <ConfirmDialog
        open={confirmSaveOpen}
        onClose={() => setConfirmSaveOpen(false)}
        onConfirm={proceedSave}
        title={quotation ? "Update Quotation?" : "Save New Quotation?"}
        description={
          quotation
            ? `Are you sure you want to save all changes to Quotation "${quotation.quotation_no}"?`
            : "Are you sure you want to create and save this new quotation?"
        }
        confirmLabel={quotation ? "Yes, Update" : "Yes, Save"}
        loading={saving}
        variant="primary"
      />

      {/* Confirm Delete Line Item Dialog */}
      <ConfirmDialog
        open={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete) {
            setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== itemToDelete.index)));
            toast.success("Item removed from quotation.");
            setItemToDelete(null);
          }
        }}
        title="Remove Line Item?"
        description={`Are you sure you want to remove item #${itemToDelete ? itemToDelete.index + 1 : ""}${
          itemToDelete?.name ? ` ("${itemToDelete.name}")` : ""
        } from this quotation?`}
        confirmLabel="Yes, Remove"
        variant="danger"
      />

      {/* Confirm Delete Attachment Dialog */}
      <ConfirmDialog
        open={Boolean(attachmentToDelete)}
        onClose={() => setAttachmentToDelete(null)}
        onConfirm={() => {
          if (attachmentToDelete) {
            handleDeleteAttachment(attachmentToDelete.index, attachmentToDelete.att);
            setAttachmentToDelete(null);
          }
        }}
        title="Remove Attachment?"
        description={`Are you sure you want to remove "${attachmentToDelete?.att.file_name}" from this quotation?`}
        confirmLabel="Yes, Remove"
        variant="danger"
      />
    </form>
  );
}

