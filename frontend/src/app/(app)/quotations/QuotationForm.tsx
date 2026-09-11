"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Info, RefreshCw, Trash2, Upload, X, ZoomIn } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useList } from "@/lib/hooks";
import { Client, Company, Country, CustomFieldDefinition, ProjectSummary, QuotationColumn, QuotationDetail, QuotationItemDetail, QuotationStatus } from "@/lib/types";
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
import { ActivityTimeline } from "@/components/ui/ActivityTimeline";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";

function blankItem(): QuotationItemDetail {
  return { description: "", qty: "1", rate: "0", image: null, extra_data: {} };
}

let columnCounter = 0;
function newColumnKey() {
  columnCounter += 1;
  return `custom_${Date.now()}_${columnCounter}`;
}

export function QuotationForm({ quotation, initialProjectId }: { quotation?: QuotationDetail; initialProjectId?: number }) {
  const router = useRouter();
  const toast = useToast();
  const { activeOrganization } = useOrganization();
  const baseCurrency = activeOrganization?.default_currency_code || "INR";
  const { rates, getRate } = useForex();

  const { items: rawClients, reload: reloadClients } = useList<Client>("/api/clients/?page_size=200");
  const { items: companies } = useList<Company>("/api/companies/?page_size=200");
  const { items: countries } = useList<Country>("/api/countries/");
  const [clients, setClients] = useState<Client[]>([]);
  // Seed local state from the fetched list, but keep it separate so a
  // fast-track "+ Add new client" can append to it without a refetch.
  useEffect(() => {
    if (rawClients.length) setClients(rawClients);
  }, [rawClients]);
  const { items: projects } = useList<ProjectSummary>("/api/projects/?page_size=200");

  const [quickAddClientOpen, setQuickAddClientOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | "">("");
  const [previewLightboxImage, setPreviewLightboxImage] = useState<string | null>(null);

  const [quotationDate, setQuotationDate] = useState(quotation?.quotation_date ?? new Date().toISOString().slice(0, 10));
  const [client, setClient] = useState<number | "">(quotation?.client ?? "");
  const [project, setProject] = useState<number | "">(quotation?.project ?? initialProjectId ?? "");
  const [subject, setSubject] = useState(quotation?.subject ?? "");
  const [toName, setToName] = useState(quotation?.to_name ?? "");
  const [toAddress, setToAddress] = useState(quotation?.to_address ?? "");
  const [introText, setIntroText] = useState(
    quotation?.intro_text ??
      "With The Above Reference, We Are Pleased To Supply The Material With The Following Rates As Per Terms & Conditions Stated Below. Please Sanction The Rates And Place The Order At The Earliest."
  );
  const [notes, setNotes] = useState(
    quotation?.notes ??
      "1. GST Should be Extra as per Government Rules.\n2. Transportation charge will be extra as per the Location of Delivery.\n3. Payment to be made by Payees A/c. Cheque, Draft or NEFT / RTGS / IMPS only.\n4. Subject to Surat Jurisdiction."
  );
  const [footerContent, setFooterContent] = useState(quotation?.footer_content ?? "");
  const [colQtyLabel, setColQtyLabel] = useState(quotation?.col_qty_label ?? "Qty");
  const [colRateLabel, setColRateLabel] = useState(quotation?.col_rate_label ?? "Rate (Per Piece)");
  const [currencyCode, setCurrencyCode] = useState(quotation?.currency_code ?? "");
  const [status, setStatus] = useState<QuotationStatus>(quotation?.status ?? "draft");
  const [columns, setColumns] = useState<QuotationColumn[]>(quotation?.columns_config ?? []);
  const [items, setItems] = useState<QuotationItemDetail[]>(
    quotation?.items?.length ? quotation.items : [blankItem()]
  );

  // Pre-seed default custom columns if new quotation
  useEffect(() => {
    if (!quotation) {
      apiFetch<CustomFieldDefinition[]>("/api/custom-fields/?module=quotation_item")
        .then((defs) => {
          if (defs.length > 0 && columns.length === 0) {
            const initialCols: QuotationColumn[] = defs.map((d) => ({
              key: d.field_key,
              label: d.label,
            }));
            setColumns(initialCols);
          }
        })
        .catch(() => {});
    }
  }, [quotation]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientOptions = clients.map((c) => ({
    value: c.id,
    label: c.company_name ? `${c.client_name} (${c.company_name})` : c.client_name,
    sublabel: c.company_name || undefined,
  }));
  const companyOptions = companies.map((comp) => ({
    value: comp.id,
    label: comp.company_name,
    sublabel: [comp.city, comp.contact_name].filter(Boolean).join(" · ") || undefined,
  }));

  const selectedClient = clients.find((c) => c.id === client);
  const effectiveCurrency = currencyCode || selectedClient?.currency_code || baseCurrency;

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

      // If there's an associated client for this company, auto-select it if not set
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
            if (!isNaN(currentRate) && currentRate > 0) {
              const convertedRate = (currentRate * factor).toFixed(2);
              return { ...it, rate: convertedRate };
            }
            return it;
          }),
        );
        toast.success(
          `Converted items from ${fromCurr} to ${toCurr} (1 ${fromCurr} = ${factor < 0.01 ? factor.toFixed(6) : factor.toFixed(4)} ${toCurr}).`,
        );
      }
    }
  };

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0), 0),
    [items],
  );

  function updateItem(index: number, patch: Partial<QuotationItemDetail>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function updateItemExtra(index: number, key: string, value: string) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, extra_data: { ...it.extra_data, [key]: value } } : it)));
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
      }),
    );
  }

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
        to_name: toName,
        to_address: toAddress,
        subject,
        intro_text: introText,
        notes,
        footer_content: footerContent,
        col_qty_label: colQtyLabel,
        col_rate_label: colRateLabel,
        columns_config: columns,
        status,
        items: items.map((it) => ({
          description: it.description,
          qty: it.qty,
          rate: it.rate,
          image: it.image || null,
          extra_data: it.extra_data,
        })),
      };
      if (currencyCode) payload.currency_code = currencyCode;

      if (quotation) {
        await apiFetch<QuotationDetail>(`/api/quotations/${quotation.id}/`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Quotation updated.");
        router.push("/quotations");
      } else {
        await apiFetch<QuotationDetail>("/api/quotations/", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Quotation created.");
        router.push("/quotations");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this quotation.");
    } finally {
      setSaving(false);
    }
  }

  const { can } = useAuth();
  const [creatingOrder, setCreatingOrder] = useState(false);

  async function handleCreateOrder() {
    if (!quotation) return;
    setCreatingOrder(true);
    try {
      const order = await apiFetch<{ id: number; order_no: string }>(`/api/quotations/${quotation.id}/create-order/`, {
        method: "POST",
        body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), tax_percent: 0 }),
      });
      toast.success(`Order ${order.order_no} created and quotation marked as Accepted (Won).`);
      router.push(`/orders/${order.id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't create an order from this quotation.");
    } finally {
      setCreatingOrder(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-mono text-2xl font-extrabold text-ink">{quotation ? quotation.quotation_no : "New Quotation"}</h1>
        <div className="flex items-center gap-2">
          {quotation && can("orders", "add") && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleCreateOrder}
              loading={creatingOrder}
              className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            >
              Convert to Order
            </Button>
          )}
          {quotation && (
            <a href={`/quotations/${quotation.id}/print`} target="_blank" rel="noreferrer">
              <Button type="button" variant="secondary">
                Preview
              </Button>
            </a>
          )}
          <Button type="submit" variant="primary" loading={saving}>
            Save
          </Button>
        </div>
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Client" required>
            <Combobox
              value={client || null}
              onChange={(v) => handleClientChange(Number(v))}
              options={clientOptions}
              placeholder="Select client..."
              onAddNew={() => setQuickAddClientOpen(true)}
              addNewLabel="Add new client"
            />
          </Field>
          {companies.length > 0 && (
            <Field label="Auto-fill by Company (optional)" hint="Picking a company automatically populates recipient name and full address">
              <Combobox
                value={selectedCompanyId || null}
                onChange={(v) => handleCompanySelect(Number(v))}
                options={companyOptions}
                placeholder="Select company to auto-fill..."
              />
            </Field>
          )}
          <Field label="Quotation Date" required>
            <Input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} required />
          </Field>
          <Field label="Currency" hint="Changing currency instantly converts all line item rates.">
            <div className="flex flex-wrap items-center gap-3">
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
                <span className="flex items-center gap-1.5 text-xs font-semibold text-primary-700 bg-primary-50 px-2.5 py-1.5 rounded-lg border border-primary-100">
                  <RefreshCw className="h-3 w-3 text-primary-600" />
                  1 {effectiveCurrency} = {getRate(effectiveCurrency, baseCurrency, baseCurrency).toFixed(4)} {baseCurrency}
                </span>
              )}
            </div>
          </Field>
          <Field label="Subject">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. 100% Scheme Board Change" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="To Name" hint="Client or Company Name on Quotation">
            <Input value={toName} onChange={(e) => setToName(e.target.value)} placeholder="e.g. Kalamandir Jewellers Ltd." />
          </Field>
          <Field label="To Address" hint="Company office or delivery location address">
            <Textarea value={toAddress} onChange={(e) => setToAddress(e.target.value)} rows={2} placeholder="e.g. Corporate House, VIP Road, Surat" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Line Items"
          action={
            <button type="button" onClick={addColumn} className="text-[13px] font-semibold text-ink-muted hover:text-primary-500 cursor-pointer">
              + Add Custom Column
            </button>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                <th className="px-5 py-2.5 text-left">Description</th>
                <th className="w-24 px-3 py-2.5 text-center">Image</th>
                {columns.map((col) => (
                  <th key={col.key} className="px-3 py-2.5 text-left">
                    <div className="flex items-center gap-1">
                      <input
                        value={col.label}
                        onChange={(e) => setColumns((prev) => prev.map((c) => (c.key === col.key ? { ...c, label: e.target.value } : c)))}
                        className="w-24 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-[11px] font-bold tracking-wider text-ink-faint uppercase focus:border-primary-400 focus:outline-none"
                      />
                      <button type="button" onClick={() => removeColumn(col.key)} className="text-ink-faint hover:text-primary-600 cursor-pointer">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="w-20 px-3 py-2.5 text-right">
                  <input
                    value={colQtyLabel}
                    onChange={(e) => setColQtyLabel(e.target.value)}
                    className="w-16 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-right text-[11px] font-bold tracking-wider text-ink-faint uppercase focus:border-primary-400 focus:outline-none"
                  />
                </th>
                <th className="w-28 px-3 py-2.5 text-right">
                  <input
                    value={colRateLabel}
                    onChange={(e) => setColRateLabel(e.target.value)}
                    className="w-24 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-right text-[11px] font-bold tracking-wider text-ink-faint uppercase focus:border-primary-400 focus:outline-none"
                  />
                </th>
                <th className="w-28 px-3 py-2.5 text-right">Amount</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const amount = (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0);
                const displayImg = it.image
                  ? it.image.startsWith("data:")
                    ? it.image
                    : mediaUrl(it.image) || it.image
                  : null;

                return (
                  <tr key={i} className="border-b border-border last:border-b-0">
                    <td className="px-5 py-2.5">
                      <Input value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} placeholder="Item description / specs" />
                    </td>

                    {/* Image Column */}
                    <td className="px-3 py-2.5 text-center align-middle">
                      {displayImg ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewLightboxImage(displayImg)}
                            className="relative group h-9 w-9 rounded-md border border-border overflow-hidden bg-white p-0.5 shadow-2xs hover:border-primary-400 cursor-pointer"
                            title="Click to preview"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={displayImg} alt="Item thumbnail" className="h-full w-full object-contain" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                              <ZoomIn className="h-3 w-3 text-white" />
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateItem(i, { image: null })}
                            className="text-ink-faint hover:text-rose-600 p-1 transition cursor-pointer"
                            title="Remove image"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-1 rounded-md border border-dashed border-border-strong px-2 text-[11px] font-semibold text-ink-muted hover:border-primary-400 hover:text-primary-600 hover:bg-surface-sunken transition">
                          <ImageIcon className="h-3.5 w-3.5" />
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
                      <td key={col.key} className="px-3 py-2.5">
                        <Input value={it.extra_data[col.key] ?? ""} onChange={(e) => updateItemExtra(i, col.key, e.target.value)} />
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      <Input type="number" step="0.01" min="0" value={it.qty} onChange={(e) => updateItem(i, { qty: e.target.value })} className="text-right" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Input type="number" step="0.01" min="0" value={it.rate} onChange={(e) => updateItem(i, { rate: e.target.value })} className="text-right" />
                    </td>
                    <td className="tnum px-3 py-2.5 text-right text-[13.5px] font-semibold text-ink">{formatCurrency(amount, effectiveCurrency)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button type="button" onClick={() => setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)))} className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-primary-50 hover:text-primary-600 cursor-pointer">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-border px-5 py-3 gap-2">
          <button type="button" onClick={() => setItems((prev) => [...prev, blankItem()])} className="text-[13px] font-semibold text-primary-500 hover:text-primary-600 cursor-pointer">
            + Add Line Item
          </button>
          <div className="flex items-center gap-3">
            {effectiveCurrency !== baseCurrency && (
              <span className="text-xs text-ink-muted">
                ≈ <strong className="font-mono text-ink">{formatCurrency(subtotal * getRate(effectiveCurrency, baseCurrency, baseCurrency), baseCurrency)}</strong>
              </span>
            )}
            <span className="tnum text-[13.5px] font-bold text-ink">
              Subtotal: {formatCurrency(subtotal, effectiveCurrency)}
            </span>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <Field label="Intro Text">
          <Textarea value={introText} onChange={(e) => setIntroText(e.target.value)} placeholder="Dear Customer, thank you for the opportunity to quote..." />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field label="Footer Content">
          <Textarea value={footerContent} onChange={(e) => setFooterContent(e.target.value)} rows={2} />
        </Field>
      </Card>

      {quotation?.id && (
        <ActivityTimeline
          endpoint={`/api/quotations/${quotation.id}/timeline/`}
          refreshTrigger={saving}
          title="Quotation History & Activity Timeline"
        />
      )}

      {error && <p className="text-[13px] font-medium text-primary-600">{error}</p>}

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

      <ImageLightboxModal
        open={Boolean(previewLightboxImage)}
        onClose={() => setPreviewLightboxImage(null)}
        images={previewLightboxImage ? [{ image: previewLightboxImage }] : []}
      />
    </form>
  );
}

