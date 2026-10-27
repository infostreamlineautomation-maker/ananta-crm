"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  FileUp,
  MessageSquare,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useList } from "@/lib/hooks";
import {
  Client,
  Company,
  Country,
  Product,
  ProjectSummary,
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
import { ActivityTimeline } from "@/components/ui/ActivityTimeline";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";
import { QuotationImportModal } from "@/components/quotations/QuotationImportModal";

function blankItem(): QuotationItemDetail {
  return {
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

let columnCounter = 0;
function newColumnKey() {
  columnCounter += 1;
  return `custom_${Date.now()}_${columnCounter}`;
}

export function QuotationForm({
  quotation,
  initialProjectId,
}: {
  quotation?: QuotationDetail;
  initialProjectId?: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const { activeOrganization } = useOrganization();
  const baseCurrency = activeOrganization?.default_currency_code || "INR";
  const { rates, getRate } = useForex();
  const { can } = useAuth();

  const { items: rawClients, reload: reloadClients } = useList<Client>("/api/clients/?page_size=200");
  const { items: companies } = useList<Company>("/api/companies/?page_size=200");
  const { items: countries } = useList<Country>("/api/countries/");
  const { items: rawSuppliers, reload: reloadSuppliers } = useList<Supplier>("/api/suppliers/?page_size=300");
  const { items: products } = useList<Product>("/api/products/?page_size=500");
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

  // Section 1: Line Items / Supplier Costing Table
  const [columns, setColumns] = useState<QuotationColumn[]>(quotation?.columns_config ?? []);
  const [colQtyLabel, setColQtyLabel] = useState(quotation?.col_qty_label ?? "Qty");
  const [colRateLabel, setColRateLabel] = useState(quotation?.col_rate_label ?? "Client Rate");
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
        return {
          ...it,
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

  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  function applyImportedData(data: any) {
    if (!data) return;
    if (data.quotation_date) setQuotationDate(data.quotation_date);
    if (data.client_id) setClient(data.client_id);
    if (data.to_name) setToName(data.to_name);
    if (data.to_address) setToAddress(data.to_address);
    if (data.subject) setSubject(data.subject);
    if (data.supplier_id) setSupplierId(data.supplier_id);
    if (data.intro_text) setIntroText(data.intro_text);
    if (data.notes) setNotes(data.notes);
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
      const desc = it.description ? it.description.trim() : `Item ${idx + 1}`;
      const qty = it.qty || "1";
      const clientRate = it.rate || "0";
      lines.push(`*${desc}*`);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!client) {
      setError("Pick a client before saving.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        quotation_date: quotationDate,
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
        col_qty_label: colQtyLabel,
        col_rate_label: colRateLabel,
        columns_config: columns,
        status,
        items: items.map((it) => ({
          product: it.product || null,
          description: it.description,
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
        toast.success("Quotation updated.");
        router.push("/quotations");
      } else {
        await apiFetch<QuotationDetail>("/api/quotations/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Quotation created.");
        router.push("/quotations");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this quotation.");
    } finally {
      setSaving(false);
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-border">
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
        </div>
      </Card>

      {/* Supplier Costing & Margin Table Card */}
      <Card className="flex flex-col overflow-hidden">
        {/* Header Title & Subtitle */}
        <div className="border-b border-border p-5">
          <h2 className="text-base font-bold text-ink">
            Supplier Costing &amp; Profit Calculator
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Internal margin calculator. Enter supplier cost and profit margin % or per-unit profit to compute Client Rate.
          </p>
        </div>

        {/* Toolbar Strip: Client, Supplier & Spec Column Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-sunken/40 px-5 py-2.5 text-xs font-medium">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 shadow-2xs">
              <span className="text-ink-muted">Client:</span>
              <strong className="text-ink">{selectedClient?.client_name || toName || "Client"}</strong>
            </div>

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
          </div>

          <button
            type="button"
            onClick={addColumn}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline cursor-pointer flex items-center gap-1 shrink-0 ml-auto"
          >
            <Plus className="h-3.5 w-3.5" /> Add Spec Column
          </button>
        </div>

        {/* Multi-Tier Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              {/* Tier 1 Header */}
              <tr className="border-b border-border bg-surface-sunken/60 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                <th rowSpan={2} className="w-12 px-3 py-2 text-center border-r border-border">
                  Sr. No.
                </th>
                <th rowSpan={2} className="min-w-[220px] px-4 py-2 text-left border-r border-border">
                  Product / Description
                </th>
                <th rowSpan={2} className="w-24 px-2 py-2 text-center border-r border-border">
                  Reference
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
                  Supplier Qty &amp; Rate
                </th>
                {/* Spanning Header: Client Given Rate */}
                <th
                  colSpan={4}
                  className="px-3 py-1.5 text-center border-r border-border bg-surface-sunken font-bold text-ink"
                >
                  Client Given Rate (Profit Calculation)
                </th>
                <th rowSpan={2} className="w-10 px-2 py-2 text-center"></th>
              </tr>

              {/* Tier 2 Sub-Headers */}
              <tr className="border-b border-border bg-surface-sunken/30 text-[10.5px] font-bold uppercase tracking-wider text-ink-muted">
                {/* Supplier Columns */}
                <th className="w-24 px-2 py-1.5 text-right border-r border-border">Qty.</th>
                <th className="w-28 px-2 py-1.5 text-right border-r border-border font-bold text-ink">
                  Rate
                </th>
                {/* Client Profit & Margin Columns */}
                <th className="w-24 px-2 py-1.5 text-right border-r border-border font-bold text-ink">
                  Add %
                </th>
                <th className="w-24 px-2 py-1.5 text-right border-r border-border font-bold text-ink">
                  Profit
                </th>
                <th className="w-28 px-2 py-1.5 text-right border-r border-border font-bold text-ink">
                  Client Rate
                </th>
                <th className="w-28 px-2 py-1.5 text-right border-r border-border font-bold text-success-700">
                  Total Profit
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
                      <div className="relative">
                        <Input
                          value={it.description}
                          onChange={(e) => handleItemChange(i, "description", e.target.value)}
                          placeholder="e.g. Corrugated Box / Shubh Store Kit"
                          list={`product-list-${i}`}
                          className="font-medium text-ink"
                        />
                        <datalist id={`product-list-${i}`}>
                          {products.map((p) => (
                            <option key={p.id} value={p.product_name} />
                          ))}
                        </datalist>
                      </div>
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
                          setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)))
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

        {/* Section 1 Footer Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-border px-5 py-3 gap-3 bg-surface-sunken/40">
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, blankItem()])}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 cursor-pointer w-fit"
          >
            <Plus className="h-4 w-4" /> Add Item / Tier Row
          </button>

          {/* Financial Totals */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-ink-muted">Supplier Cost:</span>
              <strong className="font-bold text-ink tnum">{formatCurrency(totalSupplierCost, effectiveCurrency)}</strong>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-ink-muted">Net Profit:</span>
              <strong className="font-bold text-success-700 tnum">{formatCurrency(totalProfit, effectiveCurrency)}</strong>
            </div>

            <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 shadow-2xs">
              <span className="text-ink-muted">Client Subtotal:</span>
              <strong className="font-extrabold text-primary-600 text-sm tnum">
                {formatCurrency(subtotal, effectiveCurrency)}
              </strong>
            </div>
          </div>
        </div>
      </Card>

      {/* WhatsApp Proposal Card */}
      <Card className="flex flex-col gap-4 p-5">
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
            rows={8}
            className="font-mono text-xs leading-relaxed"
          />
        </div>
      </Card>

      {/* Document Terms & Print Notes Card */}
      <Card className="flex flex-col gap-4 p-5">
        <div className="border-b border-border pb-3">
          <h2 className="text-base font-bold text-ink">Document Terms &amp; Print Notes</h2>
          <p className="text-xs text-ink-muted mt-0.5">Formal introduction and conditions for printed PDF</p>
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
    </form>
  );
}

