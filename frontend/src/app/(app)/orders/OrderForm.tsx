"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, MessageSquare, Printer, RefreshCw, Trash2, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useList } from "@/lib/hooks";
import { Client, Country, CustomFieldDefinition, OrderDetail, OrderImage, OrderItemDetail, Product, QuotationColumn, Supplier } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { useForex } from "@/lib/forex";
import { useOrganization } from "@/lib/organization-context";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Combobox } from "@/components/ui/Combobox";
import { SlideOver } from "@/components/ui/SlideOver";
import { ClientForm } from "../clients/page";
import { SendNotificationModal } from "@/components/notifications/SendNotificationModal";
import { ActivityTimeline } from "@/components/ui/ActivityTimeline";
import { ProjectImageUploader } from "@/components/orders/ProjectImageUploader";

function blankItem(): OrderItemDetail {
  return { product: "", description: "", qty: "1", rate: "0", extra_data: {} };
}

let columnCounter = 0;
function newColumnKey() {
  columnCounter += 1;
  return `custom_${Date.now()}_${columnCounter}`;
}

export function OrderForm({ order }: { order?: OrderDetail; initialProjectId?: number }) {
  const router = useRouter();
  const toast = useToast();
  const { activeOrganization } = useOrganization();
  const baseCurrency = activeOrganization?.default_currency_code || "INR";
  const { rates, getRate } = useForex();

  const { items: rawClients, reload: reloadClients } = useList<Client>("/api/clients/?page_size=200");
  const { items: countries } = useList<Country>("/api/countries/");
  const { items: suppliers } = useList<Supplier>("/api/suppliers/?page_size=200");
  const { items: products } = useList<Product>("/api/products/?page_size=200");

  const [clients, setClients] = useState<Client[]>([]);
  const [quickAddClientOpen, setQuickAddClientOpen] = useState(false);

  useEffect(() => {
    if (rawClients.length) setClients(rawClients);
  }, [rawClients]);

  const [date, setDate] = useState(order?.date ?? new Date().toISOString().slice(0, 10));
  const [client, setClient] = useState<number | "">(order?.client ?? "");
  const [projectTitle, setProjectTitle] = useState(order?.project_title ?? "");
  const [currencyCode, setCurrencyCode] = useState(order?.currency_code ?? "");
  const [supplier, setSupplier] = useState<number | "">(order?.supplier ?? "");
  const [deliveryTime, setDeliveryTime] = useState(order?.delivery_time ?? "");
  const [description, setDescription] = useState(order?.description ?? "");
  const [taxPercent, setTaxPercent] = useState(order?.tax_percent ?? "0");
  const [deliveryStatus, setDeliveryStatus] = useState(order?.delivery_status ?? "pending");
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "advance" | "partial" | "paid">(order?.payment_status ?? "pending");
  const [existingImages, setExistingImages] = useState<OrderImage[]>(order?.images ?? []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [paidAmount, setPaidAmount] = useState(
    order?.paid_amount !== undefined && order?.paid_amount !== null
      ? String(order.paid_amount)
      : order?.payment_status === "paid" && order?.grand_total
      ? String(order.grand_total)
      : "0"
  );
  const [columns, setColumns] = useState<QuotationColumn[]>(order?.columns_config ?? []);
  const [items, setItems] = useState<OrderItemDetail[]>(
    order?.items.length
      ? order.items.map((it) => ({ ...it, extra_data: it.extra_data || {} }))
      : [blankItem()]
  );

  // If creating new order, load default custom field columns for order_item
  useEffect(() => {
    if (!order) {
      apiFetch<CustomFieldDefinition[]>("/api/custom-fields/?module=order_item")
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
  }, [order]);

  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientOptions = clients.map((c) => ({
    value: c.id,
    label: c.company_name ? `${c.client_name} (${c.company_name})` : c.client_name,
    sublabel: c.company_name || undefined,
  }));
  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.supplier_name }));
  const productOptions = products.map((p) => ({ value: p.id, label: p.product_name }));

  const selectedClient = clients.find((c) => c.id === client);
  const effectiveCurrency = currencyCode || selectedClient?.currency_code || baseCurrency;

  const handleClientChange = (newClientId: number) => {
    setClient(newClientId);
    const cli = clients.find((c) => c.id === newClientId);
    if (cli && cli.currency_code && !order) {
      handleCurrencyChange(cli.currency_code);
    }
  };

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

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0), 0);
    const tax = subtotal * ((parseFloat(taxPercent) || 0) / 100);
    return { subtotal, tax, grandTotal: subtotal + tax };
  }, [items, taxPercent]);

  const calculatedDueAmount = useMemo(() => {
    const total = totals.grandTotal;
    const paid = parseFloat(paidAmount) || 0;
    return Math.max(0, total - paid);
  }, [totals.grandTotal, paidAmount]);

  function handlePaymentStatusChange(status: "pending" | "advance" | "partial" | "paid") {
    setPaymentStatus(status);
    if (status === "paid") {
      setPaidAmount(totals.grandTotal.toFixed(2));
    } else if (status === "pending") {
      setPaidAmount("0");
    } else if (status === "advance" || status === "partial") {
      const currentPaid = parseFloat(paidAmount) || 0;
      if (currentPaid <= 0 || currentPaid >= totals.grandTotal) {
        setPaidAmount((totals.grandTotal / 2).toFixed(2));
      }
    }
  }

  function updateItem(index: number, patch: Partial<OrderItemDetail>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function updateItemExtra(index: number, key: string, value: string) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, extra_data: { ...(it.extra_data || {}), [key]: value } } : it
      )
    );
  }

  function addColumn() {
    const key = newColumnKey();
    const label = `Field ${columns.length + 1}`;
    setColumns((prev) => [...prev, { key, label }]);
  }

  function removeColumn(key: string) {
    setColumns((prev) => prev.filter((c) => c.key !== key));
    setItems((prev) =>
      prev.map((it) => {
        const rest = { ...(it.extra_data || {}) };
        delete rest[key];
        return { ...it, extra_data: rest };
      })
    );
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!client) {
      setError("Pick a client before saving.");
      return;
    }
    if (items.some((it) => !it.product)) {
      setError("Every line item needs a product selected.");
      return;
    }

    setSaving(true);
    try {
      let finalPaid = "0.00";
      if (paymentStatus === "paid") {
        finalPaid = totals.grandTotal.toFixed(2);
      } else if (paymentStatus === "partial" || paymentStatus === "advance") {
        finalPaid = (parseFloat(paidAmount) || 0).toFixed(2);
      }

      const payload: Record<string, unknown> = {
        date,
        client,
        project_title: projectTitle,
        currency_code: effectiveCurrency,
        supplier: supplier || null,
        delivery_time: deliveryTime,
        description,
        columns_config: columns,
        tax_percent: taxPercent,
        delivery_status: deliveryStatus,
        payment_status: paymentStatus,
        paid_amount: finalPaid,
        items: items.map((it) => ({
          product: it.product,
          description: it.description,
          qty: it.qty,
          rate: it.rate,
          extra_data: it.extra_data || {},
        })),
      };

      let savedOrder: OrderDetail;
      if (order) {
        savedOrder = await apiFetch<OrderDetail>(`/api/orders/${order.id}/`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        savedOrder = await apiFetch<OrderDetail>("/api/orders/", { method: "POST", body: JSON.stringify(payload) });
      }

      // Upload pending images
      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const fd = new FormData();
          fd.append("order", String(savedOrder.id));
          fd.append("image", file);
          await apiFetch<OrderImage>("/api/order-images/", {
            method: "POST",
            body: fd,
          });
        }
      }

      toast.success(order ? "Project updated." : "Project created.");
      router.push("/orders");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this project.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!order) return;
    setCopying(true);
    try {
      const copy = await apiFetch<OrderDetail>(`/api/orders/${order.id}/copy/`, {
        method: "POST",
        body: JSON.stringify({ date: new Date().toISOString().slice(0, 10) }),
      });
      toast.success(`Copied to ${copy.order_no}.`);
      router.push(`/orders/${copy.id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't copy this project.");
    } finally {
      setCopying(false);
    }
  }

  const baseGrandTotal = effectiveCurrency !== baseCurrency ? totals.grandTotal * getRate(effectiveCurrency, baseCurrency, baseCurrency) : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-extrabold text-ink">
            {order ? order.order_no : "New Project (AUTO)"}
          </h1>
          {projectTitle && (
            <p className="text-sm font-semibold text-ink-muted mt-0.5">{projectTitle}</p>
          )}
        </div>
        <div className="flex gap-2">
          {order && (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setNotifyOpen(true)}
                title="Send notification to client via Email or WhatsApp"
              >
                <MessageSquare className="h-4 w-4" /> Notify
              </Button>
              <Button type="button" variant="secondary" onClick={handleCopy} loading={copying}>
                <Copy className="h-4 w-4" /> Duplicate
              </Button>
              <Link href={`/orders/${order.id}/print`} target="_blank" rel="noreferrer">
                <Button type="button" variant="secondary">
                  <Printer className="h-4 w-4" /> Print
                </Button>
              </Link>
            </>
          )}
          <Button type="submit" variant="primary" loading={saving}>
            Save Project
          </Button>
        </div>
      </div>

      {order && (
        <SendNotificationModal
          open={notifyOpen}
          onClose={() => setNotifyOpen(false)}
          target={{
            type: "order",
            id: order.id,
            title: `Project ${order.order_no}`,
            clientName: selectedClient ? selectedClient.client_name : order.client_name,
            orderNo: order.order_no,
            amount: totals.grandTotal.toFixed(2),
            paidAmount: parseFloat(paidAmount || "0").toFixed(2),
            dueAmount: calculatedDueAmount.toFixed(2),
            currency: effectiveCurrency,
            date: date,
            status: deliveryStatus,
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card className="flex flex-col gap-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Project / Job Name" required>
                <Input
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="e.g. Diamond Standy"
                  required
                />
              </Field>
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
              <Field label="Date" required>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </Field>
              <Field label="Currency" hint="Changing currency converts all rates instantly.">
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={effectiveCurrency}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    className="max-w-[160px] font-mono font-bold"
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
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-primary-700 bg-primary-50 px-2 py-1 rounded-md border border-primary-100">
                      <RefreshCw className="h-3 w-3 text-primary-600" />
                      1 {effectiveCurrency} = {getRate(effectiveCurrency, baseCurrency, baseCurrency).toFixed(4)} {baseCurrency}
                    </span>
                  )}
                </div>
              </Field>
            </div>

            <Field label="Notes / Description (optional)">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. 350 gsm with matt / Additional notes about this project..."
                rows={2}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Vendor / Supplier (optional)">
                <Combobox
                  value={supplier || null}
                  onChange={(v) => setSupplier(Number(v))}
                  options={supplierOptions}
                  placeholder="Select vendor / supplier..."
                />
              </Field>
              <Field label="Delivery Time / Instructions">
                <Input
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  placeholder="e.g. Aje Joie chhe print thai ne / Urgent"
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Line Items (Product & Specs)"
              action={
                <button
                  type="button"
                  onClick={addColumn}
                  className="text-[13px] font-semibold text-ink-muted hover:text-primary-500 cursor-pointer"
                >
                  + Add Custom Column
                </button>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                    <th className="px-5 py-2.5 text-left">Product</th>
                    <th className="px-3 py-2.5 text-left">Description / Specs</th>
                    {columns.map((col) => (
                      <th key={col.key} className="px-3 py-2.5 text-left">
                        <div className="flex items-center gap-1">
                          <input
                            value={col.label}
                            onChange={(e) =>
                              setColumns((prev) =>
                                prev.map((c) => (c.key === col.key ? { ...c, label: e.target.value } : c))
                              )
                            }
                            className="w-24 border-b border-dashed border-border-strong bg-transparent pb-0.5 text-[11px] font-bold tracking-wider text-ink-faint uppercase focus:border-primary-400 focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => removeColumn(col.key)}
                            className="text-ink-faint hover:text-primary-600 cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="w-24 px-3 py-2.5 text-right">Qty</th>
                    <th className="w-28 px-3 py-2.5 text-right">Rate</th>
                    <th className="w-28 px-3 py-2.5 text-right">Amount</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => {
                    const amount = (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0);
                    return (
                      <tr key={i} className="border-b border-border last:border-b-0">
                        <td className="px-5 py-2.5">
                          <Combobox value={it.product || null} onChange={(v) => updateItem(i, { product: Number(v) })} options={productOptions} placeholder="Select..." />
                        </td>
                        <td className="px-3 py-2.5">
                          <Input value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} placeholder="e.g. 350 gsm with matt" />
                        </td>
                        {columns.map((col) => (
                          <td key={col.key} className="px-3 py-2.5">
                            <Input
                              value={it.extra_data?.[col.key] ?? ""}
                              onChange={(e) => updateItemExtra(i, col.key, e.target.value)}
                              placeholder={col.label}
                            />
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
                          <button type="button" onClick={() => removeItem(i)} className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-primary-50 hover:text-primary-600 cursor-pointer">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border px-5 py-3">
              <button type="button" onClick={() => setItems((prev) => [...prev, blankItem()])} className="text-[13px] font-semibold text-primary-500 hover:text-primary-600 cursor-pointer">
                + Add Line Item
              </button>
            </div>
          </Card>

          {order?.id && (
            <ActivityTimeline
              endpoint={`/api/orders/${order.id}/timeline/`}
              refreshTrigger={saving}
              title="Order History & Audit Timeline"
            />
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between text-[13.5px]">
              <span className="text-ink-muted">Total (Without GST)</span>
              <span className="tnum font-semibold text-ink">{formatCurrency(totals.subtotal, effectiveCurrency)}</span>
            </div>
            <Field label="GST / Tax %">
              <Input type="number" step="0.01" min="0" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} placeholder="0" />
            </Field>
            <div className="flex items-center justify-between text-[13.5px]">
              <span className="text-ink-muted">GST Tax Amount</span>
              <span className="tnum font-semibold text-ink">{formatCurrency(totals.tax, effectiveCurrency)}</span>
            </div>
            <div className="mt-1 flex flex-col gap-1 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-bold text-ink">Total Bill (With GST)</span>
                <span className="tnum text-xl font-extrabold text-primary-600">{formatCurrency(totals.grandTotal, effectiveCurrency)}</span>
              </div>
              {baseGrandTotal !== null && (
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span>In Org Base ({baseCurrency}):</span>
                  <span className="font-mono font-bold text-ink">{formatCurrency(baseGrandTotal, baseCurrency)}</span>
                </div>
              )}
            </div>
          </Card>

          <Card className="flex flex-col gap-4 p-5">
            <Field label="Delivery Status">
              <Select value={deliveryStatus} onChange={(e) => setDeliveryStatus(e.target.value as typeof deliveryStatus)}>
                <option value="pending">Pending</option>
                <option value="in_process">In Process</option>
                <option value="ready">Ready</option>
                <option value="delivered">Delivered</option>
              </Select>
            </Field>
            <Field label="Payment Status">
              <Select value={paymentStatus} onChange={(e) => handlePaymentStatusChange(e.target.value as typeof paymentStatus)}>
                <option value="pending">Pending (Unpaid)</option>
                <option value="advance">Advance (Advance Received)</option>
                <option value="partial">Partial (Partial Payment)</option>
                <option value="paid">Paid (Fully Paid)</option>
              </Select>
            </Field>

            {(paymentStatus === "advance" || paymentStatus === "partial") && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3.5 flex flex-col gap-3">
                <Field
                  label={paymentStatus === "advance" ? "Advance Amount Received" : "Partial Amount Received"}
                  hint={`Enter amount collected in ${effectiveCurrency}`}
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={totals.grandTotal}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="font-mono font-bold bg-white text-emerald-700"
                  />
                </Field>

                <div className="pt-2 border-t border-amber-200/60 flex flex-col gap-1.5 text-xs">
                  <div className="flex justify-between text-ink-muted">
                    <span>Total Bill:</span>
                    <span className="font-mono font-semibold text-ink">{formatCurrency(totals.grandTotal, effectiveCurrency)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>{paymentStatus === "advance" ? "Advance Received:" : "Amount Received:"}</span>
                    <span className="font-mono">
                      {formatCurrency(parseFloat(paidAmount) || 0, effectiveCurrency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-amber-900 font-bold border-t border-amber-200/60 pt-1 text-[13px]">
                    <span>Outstanding Due:</span>
                    <span className="font-mono text-rose-600">
                      {formatCurrency(calculatedDueAmount, effectiveCurrency)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {paymentStatus === "paid" && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs flex items-center justify-between text-emerald-800">
                <span className="font-bold">✓ Fully Settled</span>
                <span className="font-mono font-bold">{formatCurrency(totals.grandTotal, effectiveCurrency)}</span>
              </div>
            )}

            {paymentStatus === "pending" && (
              <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3 text-xs flex items-center justify-between text-rose-800">
                <span className="font-bold">Pending Full Balance</span>
                <span className="font-mono font-bold">{formatCurrency(totals.grandTotal, effectiveCurrency)}</span>
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <CardHeader title="Project Images / Proofs" />
            <ProjectImageUploader
              orderId={order?.id}
              existingImages={existingImages}
              pendingFiles={pendingFiles}
              onPendingFilesChange={setPendingFiles}
              onImageUploaded={(newImg) => setExistingImages((prev) => [...prev, newImg])}
              onImageDeleted={(delId) => setExistingImages((prev) => prev.filter((img) => img.id !== delId))}
            />
          </Card>
        </div>
      </div>

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
    </form>
  );
}
