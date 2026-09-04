"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useList } from "@/lib/hooks";
import { Client, CostingDetail, CostingItemDetail, CustomFieldDefinition, Product, ProjectSummary, QuotationColumn, Supplier } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Combobox } from "@/components/ui/Combobox";
import { QuickCreateModal } from "@/components/ui/QuickCreateModal";

function blankItem(): CostingItemDetail {
  return { supplier_rate: "0", quantity: "1", client_rate: "0", extra_data: {} };
}

let columnCounter = 0;
function newColumnKey() {
  columnCounter += 1;
  return `custom_${Date.now()}_${columnCounter}`;
}

export function CostingForm({ costing, initialProjectId }: { costing?: CostingDetail; initialProjectId?: number }) {
  const router = useRouter();
  const toast = useToast();

  const { items: rawSuppliers } = useList<Supplier>("/api/suppliers/?page_size=200");
  const { items: rawProducts } = useList<Product>("/api/products/?page_size=200");
  const { items: rawClients } = useList<Client>("/api/clients/?page_size=200");
  const { items: projects } = useList<ProjectSummary>("/api/projects/?page_size=200");

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    if (rawSuppliers.length) setSuppliers(rawSuppliers);
  }, [rawSuppliers]);
  useEffect(() => {
    if (rawProducts.length) setProducts(rawProducts);
  }, [rawProducts]);
  useEffect(() => {
    if (rawClients.length) setClients(rawClients);
  }, [rawClients]);

  const [quickAdd, setQuickAdd] = useState<"supplier" | "product" | "client" | null>(null);

  const [costingDate, setCostingDate] = useState(costing?.costing_date ?? new Date().toISOString().slice(0, 10));
  const [project, setProject] = useState<number | "">(costing?.project ?? initialProjectId ?? "");
  const [supplier, setSupplier] = useState<number | "">(costing?.supplier ?? "");
  const [product, setProduct] = useState<number | "">(costing?.product ?? "");
  const [client, setClient] = useState<number | "">(costing?.client ?? "");
  const [description, setDescription] = useState(costing?.description ?? "");
  const [columns, setColumns] = useState<QuotationColumn[]>(costing?.columns_config ?? []);
  const [items, setItems] = useState<CostingItemDetail[]>(
    costing?.items.length
      ? costing.items.map((it) => ({ ...it, extra_data: it.extra_data || {} }))
      : [blankItem()]
  );

  // If creating new costing, load default custom field columns for costing_item
  useEffect(() => {
    if (!costing) {
      apiFetch<CustomFieldDefinition[]>("/api/custom-fields/?module=costing_item")
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
  }, [costing]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectOptions = projects.map((p) => ({ value: p.id, label: p.name, sublabel: p.client_name }));
  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.supplier_name }));
  const productOptions = products.map((p) => ({ value: p.id, label: p.product_name }));
  const clientOptions = clients.map((c) => ({ value: c.id, label: c.client_name }));

  const totals = useMemo(() => {
    const supplierCost = items.reduce((sum, it) => sum + (parseFloat(it.supplier_rate) || 0) * (parseFloat(it.quantity) || 0), 0);
    const clientRevenue = items.reduce((sum, it) => sum + (parseFloat(it.client_rate) || 0) * (parseFloat(it.quantity) || 0), 0);
    const profit = clientRevenue - supplierCost;
    const profitPercent = supplierCost ? (profit / supplierCost) * 100 : 0;
    return { supplierCost, clientRevenue, profit, profitPercent };
  }, [items]);

  function updateItem(index: number, patch: Partial<CostingItemDetail>) {
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
    const col = { key: newColumnKey(), label: "New Column" };
    setColumns((prev) => [...prev, col]);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supplier || !product || !client) {
      setError("Pick (or add new) a supplier, product, and client before saving.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        costing_date: costingDate,
        project: project || null,
        supplier,
        product,
        client,
        description,
        columns_config: columns,
        items: items.map((it) => ({
          supplier_rate: it.supplier_rate,
          quantity: it.quantity,
          client_rate: it.client_rate,
          extra_data: it.extra_data || {},
        })),
      };
      if (costing) {
        await apiFetch<CostingDetail>(`/api/costings/${costing.id}/`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Costing sheet updated.");
      } else {
        await apiFetch<CostingDetail>("/api/costings/", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Costing sheet created.");
      }
      router.push("/costing");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this costing sheet.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold text-ink">{costing ? "Edit Costing Sheet" : "New Costing Sheet"}</h1>
        <Button type="submit" variant="primary" loading={saving}>
          Save
        </Button>
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date" required>
            <Input type="date" value={costingDate} onChange={(e) => setCostingDate(e.target.value)} required />
          </Field>
          <Field label="Project (optional)">
            <Combobox value={project || null} onChange={(v) => setProject(Number(v))} options={projectOptions} placeholder="Select project..." />
          </Field>
          <Field label="Supplier" required hint="Pick an existing one, or add a new name.">
            <Combobox
              value={supplier || null}
              onChange={(v) => setSupplier(Number(v))}
              options={supplierOptions}
              placeholder="Select supplier..."
              onAddNew={() => setQuickAdd("supplier")}
              addNewLabel="Add new supplier"
            />
          </Field>
          <Field label="Product" required hint="Pick an existing one, or add a new name.">
            <Combobox
              value={product || null}
              onChange={(v) => setProduct(Number(v))}
              options={productOptions}
              placeholder="Select product..."
              onAddNew={() => setQuickAdd("product")}
              addNewLabel="Add new product"
            />
          </Field>
          <Field label="Client" required hint="Pick an existing one, or add a new name.">
            <Combobox
              value={client || null}
              onChange={(v) => setClient(Number(v))}
              options={clientOptions}
              placeholder="Select client..."
              onAddNew={() => setQuickAdd("client")}
              addNewLabel="Add new client"
            />
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </Card>

      <Card>
        <CardHeader
          title="Line Items"
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
                <th className="px-5 py-2.5 text-right">Supplier Rate</th>
                <th className="px-3 py-2.5 text-right">Quantity</th>
                <th className="px-3 py-2.5 text-right">Client Rate</th>
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
                <th className="px-3 py-2.5 text-right">Profit</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const profit = ((parseFloat(it.client_rate) || 0) - (parseFloat(it.supplier_rate) || 0)) * (parseFloat(it.quantity) || 0);
                return (
                  <tr key={i} className="border-b border-border last:border-b-0">
                    <td className="px-5 py-2.5">
                      <Input type="number" step="0.01" min="0" value={it.supplier_rate} onChange={(e) => updateItem(i, { supplier_rate: e.target.value })} className="text-right" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Input type="number" step="0.01" min="0" value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} className="text-right" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Input type="number" step="0.01" min="0" value={it.client_rate} onChange={(e) => updateItem(i, { client_rate: e.target.value })} className="text-right" />
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
                    <td className={`tnum px-3 py-2.5 text-right text-[13.5px] font-semibold ${profit >= 0 ? "text-success-700" : "text-primary-600"}`}>
                      {formatCurrency(profit)}
                    </td>
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
        <div className="border-t border-border px-5 py-3">
          <button type="button" onClick={() => setItems((prev) => [...prev, blankItem()])} className="text-[13px] font-semibold text-primary-500 hover:text-primary-600 cursor-pointer">
            + Add Line
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Supplier Cost</p>
          <p className="tnum mt-1 text-xl font-extrabold text-ink">{formatCurrency(totals.supplierCost)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Client Revenue</p>
          <p className="tnum mt-1 text-xl font-extrabold text-ink">{formatCurrency(totals.clientRevenue)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Profit</p>
          <p className={`tnum mt-1 text-xl font-extrabold ${totals.profit >= 0 ? "text-success-700" : "text-primary-600"}`}>{formatCurrency(totals.profit)}</p>
          <span
            className={`mt-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[12px] font-bold ${
              totals.profitPercent >= 20 ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"
            }`}
          >
            {totals.profitPercent.toFixed(1)}%
          </span>
        </Card>
      </div>

      {error && <p className="text-[13px] font-medium text-primary-600">{error}</p>}

      <QuickCreateModal
        open={quickAdd === "supplier"}
        onClose={() => setQuickAdd(null)}
        title="Add Supplier"
        label="Supplier Name"
        onCreate={async (name) => {
          const created = await apiFetch<Supplier>("/api/suppliers/", { method: "POST", body: JSON.stringify({ supplier_name: name }) });
          setSuppliers((prev) => [...prev, created]);
          setSupplier(created.id);
          toast.success("Supplier added.");
        }}
      />
      <QuickCreateModal
        open={quickAdd === "product"}
        onClose={() => setQuickAdd(null)}
        title="Add Product"
        label="Product Name"
        onCreate={async (name) => {
          const created = await apiFetch<Product>("/api/products/", { method: "POST", body: JSON.stringify({ product_name: name }) });
          setProducts((prev) => [...prev, created]);
          setProduct(created.id);
          toast.success("Product added.");
        }}
      />
      <QuickCreateModal
        open={quickAdd === "client"}
        onClose={() => setQuickAdd(null)}
        title="Add Client"
        label="Client Name"
        onCreate={async (name) => {
          const created = await apiFetch<Client>("/api/clients/", { method: "POST", body: JSON.stringify({ client_name: name }) });
          setClients((prev) => [...prev, created]);
          setClient(created.id);
          toast.success("Client added.");
        }}
      />
    </form>
  );
}
