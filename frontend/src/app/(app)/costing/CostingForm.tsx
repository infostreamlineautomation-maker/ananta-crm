"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { consumeJustCreated, clearCreationOrigin } from "@/lib/creation-redirect";
import {
  BookOpen,
  Calculator,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Trash2,
  UploadCloud,
  ZoomIn,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch, ApiError } from "@/lib/api";
import { useList } from "@/lib/hooks";
import {
  Client,
  CostingDetail,
  CostingFile,
  CostingItemDetail,
  Country,
  Product,
  QuotationColumn,
  Supplier,
} from "@/lib/types";
import { formatCurrency, mediaUrl } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/SlideOver";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Combobox } from "@/components/ui/Combobox";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";
import { ClientForm } from "../clients/page";
import { SupplierForm } from "../suppliers/page";
import { ProductModal } from "@/components/products/ProductModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DraftBanner } from "@/components/ui/DraftBanner";
import { useFormDraft } from "@/lib/useFormDraft";

let columnCounter = 0;
function newColumnKey() {
  columnCounter += 1;
  return `custom_${Date.now()}_${columnCounter}`;
}

function emptyCostingItem(): CostingItemDetail {
  return {
    product: null,
    product_name: "",
    description: "",
    supplier_rate: "0",
    quantity: "1",
    client_rate: "",
    extra_data: {},
  };
}

function formatFileSize(bytes?: number | null) {
  if (!bytes || isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name?: string | null) {
  const ext = name?.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) {
    return <FileText className="h-5 w-5 text-rose-600" />;
  }
  if (["xlsx", "xls", "csv"].includes(ext)) {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
  }
  if (["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext)) {
    return <ImageIcon className="h-5 w-5 text-blue-600" />;
  }
  return <Paperclip className="h-5 w-5 text-primary-600" />;
}

export function CostingForm({ costing }: { costing?: CostingDetail; initialProjectId?: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const { items: rawSuppliers, reload: reloadSuppliers } = useList<Supplier>("/api/suppliers/?page_size=200");
  const { items: rawProducts, reload: reloadProducts } = useList<Product>("/api/products/?page_size=300");
  const { items: rawClients, reload: reloadClients } = useList<Client>("/api/clients/?page_size=200");
  const { items: countries } = useList<Country>("/api/countries/");

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
  const [activeProductRowIndex, setActiveProductRowIndex] = useState<number | null>(null);

  const [costingDate, setCostingDate] = useState(costing?.costing_date ?? new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState<number | "">(costing?.supplier ?? "");
  const [client, setClient] = useState<number | "">(costing?.client ?? "");
  const [description, setDescription] = useState(costing?.description ?? "");
  const [columns, setColumns] = useState<QuotationColumn[]>(costing?.columns_config ?? []);

  const [items, setItems] = useState<CostingItemDetail[]>(() => {
    if (costing?.items && costing.items.length > 0) {
      return costing.items.map((it, idx) => {
        const cRateNum = Number(it.client_rate || 0);
        return {
          ...it,
          product: it.product ?? (idx === 0 ? costing.product ?? null : null),
          product_name: it.product_name || (idx === 0 ? costing.product_display || "" : ""),
          description: it.description || (idx === 0 && costing.items.length === 1 ? costing.description || "" : ""),
          supplier_rate: String(it.supplier_rate ?? "0"),
          quantity: String(it.quantity ?? "1"),
          client_rate: cRateNum > 0 ? String(it.client_rate) : "",
          extra_data: it.extra_data || {},
        };
      });
    }
    return [emptyCostingItem()];
  });

  // Auto-select client, supplier, or product if just created from a redirected form
  useEffect(() => {
    const justClient = consumeJustCreated("client");
    if (justClient) {
      apiFetch<Client>(`/api/clients/${justClient.id}/`)
        .then((c) => {
          setClients((prev) => (prev.some((x) => x.id === c.id) ? prev : [c, ...prev]));
          setClient(Number(c.id));
          toast.success(`Client "${c.client_name}" selected.`);
        })
        .catch(() => {
          setClient(Number(justClient.id));
        });
    }

    const justSupplier = consumeJustCreated("supplier");
    if (justSupplier) {
      apiFetch<Supplier>(`/api/suppliers/${justSupplier.id}/`)
        .then((s) => {
          setSuppliers((prev) => (prev.some((x) => x.id === s.id) ? prev : [s, ...prev]));
          setSupplier(Number(s.id));
          toast.success(`Supplier "${s.supplier_name}" selected.`);
        })
        .catch(() => {
          setSupplier(Number(justSupplier.id));
        });
    }

    const justProduct = consumeJustCreated("product");
    if (justProduct) {
      apiFetch<Product>(`/api/products/${justProduct.id}/`)
        .then((p) => {
          setProducts((prev) => (prev.some((x) => x.id === p.id) ? prev : [p, ...prev]));
          setItems((prev) =>
            prev.map((it, idx) =>
              idx === 0 && !it.product && !it.product_name
                ? { ...it, product: p.id, product_name: p.product_name }
                : it
            )
          );
          toast.success(`Product "${p.product_name}" added.`);
        })
        .catch(() => {});
    }
  }, [toast]);

  const [files, setFiles] = useState<CostingFile[]>(() => {
    if (costing?.files && costing.files.length > 0) {
      return costing.files.map((f) => ({
        ...f,
        category: f.category || "catalogue",
      }));
    }
    if (costing?.file) {
      return [
        {
          file: costing.file,
          file_name: costing.file_name || costing.file.split("/").pop() || "Attached File",
          category: "catalogue",
        },
      ];
    }
    return [];
  });

  const catalogueInputRef = useRef<HTMLInputElement>(null);
  const rateListInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingCatalogue, setIsDraggingCatalogue] = useState(false);
  const [isDraggingRateList, setIsDraggingRateList] = useState(false);
  const [previewLightbox, setPreviewLightbox] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirmation dialog states
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<{ key: string; label: string } | null>(null);
  const [fileToDelete, setFileToDelete] = useState<CostingFile | null>(null);

  // Form Draft Caching & Auto-restore
  const draftKey = costing ? `crm_draft_costing_v2_${costing.id}` : "crm_draft_costing_v2_new";
  const formData = useMemo(
    () => ({
      costingDate,
      client,
      supplier,
      items,
      description,
      columns,
    }),
    [costingDate, client, supplier, items, description, columns]
  );

  const isDirty = useMemo(() => {
    if (!costing) {
      const hasItemData = items.some(
        (it) =>
          Boolean(it.product) ||
          Boolean(it.product_name?.trim()) ||
          Boolean(it.description?.trim()) ||
          Number(it.supplier_rate || 0) > 0 ||
          Number(it.client_rate || 0) > 0 ||
          Number(it.quantity || 1) !== 1
      );
      return Boolean(client || supplier || description || hasItemData || columns.length > 0);
    }
    return true;
  }, [costing, client, supplier, items, description, columns]);

  const {
    draftSavedAt,
    draftRestored,
    dismissDraftBanner,
    clearDraft,
  } = useFormDraft({
    key: draftKey,
    data: formData,
    isDirty: costing ? false : isDirty,
    onRestore: (draft) => {
      if (draft.costingDate !== undefined) setCostingDate(draft.costingDate);
      if (draft.client !== undefined) setClient(draft.client);
      if (draft.supplier !== undefined) setSupplier(draft.supplier);
      if (Array.isArray(draft.items) && draft.items.length > 0) setItems(draft.items);
      if (draft.description !== undefined) setDescription(draft.description);
      if (Array.isArray(draft.columns)) setColumns(draft.columns);
    },
  });

  const supplierOptions = suppliers.map((s) => ({
    value: s.id,
    label: s.rating ? `${s.supplier_name} (Grade ${s.rating})` : s.supplier_name,
    sublabel: s.company_name
      ? `${s.company_name}${s.rating ? ` · Grade ${s.rating}` : ""}`
      : s.rating
      ? `Grade ${s.rating} Supplier`
      : undefined,
  }));

  const clientOptions = clients.map((c) => ({
    value: c.id,
    label: c.company_name ? `${c.client_name} (${c.company_name})` : c.client_name,
    sublabel: c.company_name || undefined,
  }));

  const totals = useMemo(() => {
    let supplierCost = 0;
    let clientRevenue = 0;
    let hasClientRate = false;
    for (const it of items) {
      const qty = parseFloat(it.quantity || "0") || 0;
      const sRate = parseFloat(it.supplier_rate || "0") || 0;
      const cRate = parseFloat(it.client_rate || "0") || 0;
      supplierCost += sRate * qty;
      clientRevenue += cRate * qty;
      if (cRate > 0) hasClientRate = true;
    }
    const profit = clientRevenue - supplierCost;
    const profitPercent = supplierCost > 0 ? (profit / supplierCost) * 100 : 0;
    return { supplierCost, clientRevenue, profit, profitPercent, hasClientRate };
  }, [items]);

  function addColumn() {
    const col = { key: newColumnKey(), label: "New Column" };
    setColumns((prev) => [...prev, col]);
  }

  function removeColumn(key: string) {
    setColumns((prev) => prev.filter((c) => c.key !== key));
    setItems((prev) =>
      prev.map((it) => {
        const nextExtra = { ...(it.extra_data || {}) };
        delete nextExtra[key];
        return { ...it, extra_data: nextExtra };
      })
    );
  }

  function addRow() {
    setItems((prev) => [...prev, emptyCostingItem()]);
  }

  function removeRow(index: number) {
    setItems((prev) => {
      if (prev.length <= 1) return [emptyCostingItem()];
      return prev.filter((_, i) => i !== index);
    });
  }

  function updateItem(index: number, patch: Partial<CostingItemDetail>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function handleProductNameChange(index: number, val: string) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const matched = products.find((p) => p.product_name.toLowerCase() === val.trim().toLowerCase());
        if (matched) {
          return {
            ...it,
            product: matched.id,
            product_name: matched.product_name,
            description: it.description || matched.description || "",
          };
        }
        return {
          ...it,
          product: null,
          product_name: val,
        };
      })
    );
  }

  function updateItemExtra(index: number, colKey: string, val: string) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, extra_data: { ...(it.extra_data || {}), [colKey]: val } } : it
      )
    );
  }

  const handleFilesUpload = (uploadedFiles: FileList | File[] | null, category: "catalogue" | "rate_list") => {
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    const fileArray = Array.from(uploadedFiles);

    for (const f of fileArray) {
      if (f.size > 30 * 1024 * 1024) {
        toast.error(`"${f.name}" exceeds maximum allowed file size of 30MB.`);
        return;
      }
    }

    const readers = fileArray.map((fileObj) => {
      return new Promise<CostingFile>((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          resolve({
            file: String(evt.target?.result || ""),
            file_name: fileObj.name,
            file_size: fileObj.size,
            category,
          });
        };
        reader.readAsDataURL(fileObj);
      });
    });

    Promise.all(readers).then((newFiles) => {
      setFiles((prev) => [...prev, ...newFiles]);
      toast.success(
        `Attached ${newFiles.length} ${category === "catalogue" ? "catalogue" : "rate list"} file${newFiles.length > 1 ? "s" : ""}.`
      );
    });

    if (category === "catalogue" && catalogueInputRef.current) {
      catalogueInputRef.current.value = "";
    } else if (category === "rate_list" && rateListInputRef.current) {
      rateListInputRef.current.value = "";
    }
  };

  const removeFile = (fileToRemove: CostingFile) => {
    setFiles((prev) => prev.filter((f) => f !== fileToRemove));
  };

  const isImageFile = (name?: string | null) => {
    const ext = name?.split(".").pop()?.toLowerCase() || "";
    return ["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext);
  };

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supplier || !client) {
      setError("Pick (or add new) a client and supplier before saving.");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one item row before saving.");
      return;
    }
    const missingProduct = items.some((it) => !it.product && !(it.product_name || "").trim());
    if (missingProduct) {
      setError("Select or type a product / item name for every row.");
      return;
    }
    setConfirmSaveOpen(true);
  }

  async function proceedSave() {
    setConfirmSaveOpen(false);
    setSaving(true);
    try {
      const firstProdId = items.find((it) => Boolean(it.product))?.product || null;
      const payload = {
        costing_date: costingDate,
        supplier,
        client,
        product: firstProdId,
        files: files.map((f) => ({
          id: f.id,
          file: f.file,
          file_name: f.file_name || "",
          file_size: f.file_size,
          category: f.category || "catalogue",
        })),
        file: files.length > 0 ? files[0].file : null,
        file_name: files.length > 0 ? files[0].file_name || "" : "",
        description: description || "",
        columns_config: columns,
        items: items.map((it, idx) => ({
          product: it.product || null,
          product_name: (it.product_name || "").trim(),
          description: it.description || "",
          supplier_rate: it.supplier_rate !== "" && it.supplier_rate !== undefined ? String(it.supplier_rate) : "0",
          quantity: it.quantity !== "" && it.quantity !== undefined ? String(it.quantity) : "1",
          client_rate: it.client_rate !== "" && it.client_rate !== undefined ? String(it.client_rate) : "0",
          extra_data: it.extra_data || {},
          sort_order: idx,
        })),
      };
      if (costing) {
        await apiFetch<CostingDetail>(`/api/costings/${costing.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        clearDraft();
        toast.success("Costing sheet updated.");
      } else {
        await apiFetch<CostingDetail>("/api/costings/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        clearDraft();
        toast.success("Costing sheet created.");
      }
      clearCreationOrigin();
      const target = searchParams?.get("returnUrl") || searchParams?.get("from") || "/costing";
      router.push(target);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this costing sheet.");
    } finally {
      setSaving(false);
    }
  }

  const catalogueFiles = useMemo(() => files.filter((f) => f.category !== "rate_list"), [files]);
  const rateListFiles = useMemo(() => files.filter((f) => f.category === "rate_list"), [files]);

  return (
    <form onSubmit={handleFormSubmit} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold text-ink">{costing ? "Edit Costing Sheet" : "New Costing Sheet"}</h1>
        <Button type="submit" variant="primary" loading={saving}>
          Save
        </Button>
      </div>

      {draftRestored && (
        <DraftBanner
          savedAt={draftSavedAt}
          onDiscard={clearDraft}
          onDismiss={dismissDraftBanner}
        />
      )}

      <Card className="flex flex-col gap-5 p-5">
        {/* Top Metadata Header */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Costing Date" required>
            <Input type="date" value={costingDate} onChange={(e) => setCostingDate(e.target.value)} required />
          </Field>
          <Field label="Client" required hint="Pick existing or add new">
            <Combobox
              value={client || null}
              onChange={(v) => setClient(Number(v))}
              options={clientOptions}
              placeholder="Select client..."
              onAddNew={() => setQuickAdd("client")}
              addNewLabel="Add new client"
            />
          </Field>
          <Field label="Supplier / Vendor" required hint="Pick existing or add new">
            <Combobox
              value={supplier || null}
              onChange={(v) => setSupplier(Number(v))}
              options={supplierOptions}
              placeholder="Select supplier..."
              onAddNew={() => setQuickAdd("supplier")}
              addNewLabel="Add new supplier"
            />
          </Field>
        </div>

        {/* Multi-Row Costing Items & Rates Table */}
        <div className="flex flex-col rounded-xl border border-border overflow-hidden bg-surface shadow-2xs">
          {/* Toolbar Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-sunken/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary-600" />
              <h2 className="text-sm font-bold text-ink">Costing Items &amp; Rates</h2>
              <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700 border border-primary-100">
                {items.length} row{items.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={addColumn}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add Column
              </button>
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1 rounded-md bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-700 transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add Row
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <datalist id="costing-products-datalist">
              {products.map((p) => (
                <option key={p.id} value={p.product_name} />
              ))}
            </datalist>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-sunken/60 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  <th className="w-12 px-3 py-2.5 text-center border-r border-border">Sr. No.</th>
                  <th className="min-w-[280px] sm:min-w-[330px] px-4 py-2.5 text-left border-r border-border">
                    Product &amp; Description *
                  </th>
                  {columns.map((col) => (
                    <th key={col.key} className="min-w-[130px] px-3 py-2.5 text-left border-r border-border">
                      <div className="flex items-center justify-between gap-1">
                        <input
                          value={col.label}
                          onChange={(e) =>
                            setColumns((prev) =>
                              prev.map((c) => (c.key === col.key ? { ...c, label: e.target.value } : c))
                            )
                          }
                          className="w-full min-w-[80px] border-b border-dashed border-border-strong bg-transparent pb-0.5 text-[11px] font-bold text-ink uppercase focus:border-primary-500 focus:outline-none"
                          title="Click to rename column"
                        />
                        <button
                          type="button"
                          onClick={() => setColumnToDelete({ key: col.key, label: col.label })}
                          className="text-ink-faint hover:text-rose-600 p-0.5 rounded cursor-pointer shrink-0"
                          title="Remove column"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="w-24 px-3 py-2.5 text-right border-r border-border">Qty *</th>
                  <th className="w-28 px-3 py-2.5 text-right border-r border-border">Supplier Rate *</th>
                  <th className="w-28 px-3 py-2.5 text-right border-r border-border">Supplier Total</th>
                  <th className="w-32 px-3 py-2.5 text-right border-r border-border">
                    Client Rate <span className="font-normal normal-case text-ink-faint">(Opt.)</span>
                  </th>
                  <th className="w-28 px-3 py-2.5 text-right border-r border-border">Client Total</th>
                  <th className="w-28 px-3 py-2.5 text-right border-r border-border">Profit / %</th>
                  <th className="w-10 px-2 py-2.5 text-center" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {items.map((item, idx) => {
                  const qty = parseFloat(item.quantity || "0") || 0;
                  const sRate = parseFloat(item.supplier_rate || "0") || 0;
                  const hasClientRate = item.client_rate !== undefined && item.client_rate !== "" && Number(item.client_rate) > 0;
                  const cRate = parseFloat(item.client_rate || "0") || 0;
                  const rowSupplierCost = qty * sRate;
                  const rowClientTotal = qty * cRate;
                  const rowProfit = rowClientTotal - rowSupplierCost;
                  const rowMarginPct = rowSupplierCost > 0 ? (rowProfit / rowSupplierCost) * 100 : 0;

                  const currentProdName =
                    item.product_name ??
                    (item.product ? products.find((p) => p.id === item.product)?.product_name : "") ??
                    "";

                  return (
                    <tr key={idx} className="align-top hover:bg-surface-hover/40 transition-colors">
                      <td className="px-3 py-3 text-center font-mono font-semibold text-ink-muted border-r border-border">
                        {idx + 1}
                      </td>

                      {/* Product & Description Cell (matching Quotation table style) */}
                      <td className="px-3 py-2.5 border-r border-border">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="relative flex-1 min-w-0">
                              <Input
                                value={currentProdName}
                                onChange={(e) => handleProductNameChange(idx, e.target.value)}
                                placeholder="Select or type product / item *"
                                list="costing-products-datalist"
                                className="font-medium text-ink h-8.5 text-xs"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveProductRowIndex(idx);
                                setQuickAdd("product");
                              }}
                              className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-md border border-border bg-surface-sunken hover:bg-surface-hover hover:border-primary-400 text-ink-muted hover:text-primary-700 transition shadow-2xs cursor-pointer"
                              title="Add new product to catalog"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>

                          <textarea
                            value={item.description || ""}
                            onChange={(e) => updateItem(idx, { description: e.target.value })}
                            rows={2}
                            placeholder="Additional Description For Item"
                            className="w-full resize-y rounded-md border border-border/80 bg-white px-2.5 py-1.5 text-xs text-ink placeholder:italic placeholder:text-ink-faint/80 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-100 transition-colors shadow-2xs"
                          />
                        </div>
                      </td>

                      {/* Dynamic Custom Column Cells */}
                      {columns.map((col) => (
                        <td key={col.key} className="px-2.5 py-2.5 border-r border-border">
                          <Input
                            type="text"
                            value={item.extra_data?.[col.key] || ""}
                            onChange={(e) => updateItemExtra(idx, col.key, e.target.value)}
                            placeholder={`Enter ${col.label.toLowerCase()}...`}
                            className="h-8.5 text-xs"
                          />
                        </td>
                      ))}

                      {/* Qty */}
                      <td className="px-2.5 py-2.5 border-r border-border">
                        <Input
                          type="number"
                          step="any"
                          min="0.01"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                          placeholder="1"
                          className="h-8.5 text-right font-mono text-xs"
                          required
                        />
                      </td>

                      {/* Supplier Rate */}
                      <td className="px-2.5 py-2.5 border-r border-border">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={item.supplier_rate}
                          onChange={(e) => updateItem(idx, { supplier_rate: e.target.value })}
                          placeholder="0.00"
                          className="h-8.5 text-right font-mono text-xs"
                          required
                        />
                      </td>

                      {/* Supplier Total */}
                      <td className="px-3 py-3 text-right font-mono font-bold text-ink border-r border-border whitespace-nowrap">
                        {formatCurrency(rowSupplierCost)}
                      </td>

                      {/* Client Rate (Optional) */}
                      <td className="px-2.5 py-2.5 border-r border-border">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={item.client_rate ?? ""}
                          onChange={(e) => updateItem(idx, { client_rate: e.target.value })}
                          placeholder="Optional"
                          className="h-8.5 text-right font-mono text-xs"
                        />
                      </td>

                      {/* Client Total */}
                      <td className="px-3 py-3 text-right font-mono font-bold text-ink border-r border-border whitespace-nowrap">
                        {hasClientRate ? formatCurrency(rowClientTotal) : <span className="text-ink-faint font-normal">—</span>}
                      </td>

                      {/* Profit / % */}
                      <td className="px-3 py-2.5 text-right border-r border-border whitespace-nowrap">
                        {hasClientRate ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={clsx("font-mono font-bold", rowProfit >= 0 ? "text-success-700" : "text-primary-600")}>
                              {formatCurrency(rowProfit)}
                            </span>
                            <span
                              className={clsx(
                                "inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                                rowMarginPct >= 20 ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"
                              )}
                            >
                              {rowMarginPct.toFixed(1)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>

                      {/* Delete Row */}
                      <td className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          disabled={items.length <= 1}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-faint hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
                          title="Remove row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer: Add Row + Live Summary */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-surface-sunken/30 px-4 py-3">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary-300 bg-white px-3 py-1.5 text-xs font-bold text-primary-700 hover:bg-primary-50 transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add Another Row
            </button>

            <div className="flex flex-wrap items-center gap-5 ml-auto">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint block">Supplier Total Cost</span>
                <span className="tnum text-sm font-extrabold text-ink">{formatCurrency(totals.supplierCost)}</span>
              </div>
              <div className="h-6 w-px bg-border" />
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint block">Client Total Revenue</span>
                <span className="tnum text-sm font-extrabold text-ink">
                  {totals.hasClientRate ? formatCurrency(totals.clientRevenue) : "—"}
                </span>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div>
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint block">Net Profit</span>
                  <span
                    className={clsx(
                      "tnum text-sm font-extrabold",
                      !totals.hasClientRate
                        ? "text-ink-faint"
                        : totals.profit >= 0
                        ? "text-success-700"
                        : "text-primary-600"
                    )}
                  >
                    {totals.hasClientRate ? formatCurrency(totals.profit) : "—"}
                  </span>
                </div>
                {totals.hasClientRate && (
                  <span
                    className={clsx(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold",
                      totals.profitPercent >= 20 ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"
                    )}
                  >
                    {totals.profitPercent.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dual Attachment Sections: Catalogue and Rate List */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Section 1: Catalogue / Samples */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-sunken/20 p-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary-600" />
                <h3 className="text-sm font-bold text-ink">Catalogue / Samples</h3>
                <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700 border border-primary-100">
                  {catalogueFiles.length}
                </span>
              </div>
              <span className="text-[11px] text-ink-muted">Brochures, samples, mockups</span>
            </div>

            {catalogueFiles.length > 0 && (
              <div className="flex flex-col gap-2">
                {catalogueFiles.map((f, idx) => {
                  const fPath = f.file || f.file_url || "";
                  const fUrl = fPath ? (fPath.startsWith("data:") ? fPath : mediaUrl(fPath) || fPath) : "";
                  const fName = f.file_name || (fPath ? fPath.split("/").pop() : `Catalogue File #${idx + 1}`);
                  const isImg = isImageFile(fName || fUrl);

                  return (
                    <div
                      key={f.id ? `f-cat-${f.id}` : `f-cat-new-${idx}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 transition-colors hover:border-primary-300"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-sunken border border-border shadow-2xs">
                          {getFileIcon(fName || fUrl)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-ink" title={fName || undefined}>
                            {fName}
                          </p>
                          <p className="text-[10.5px] text-ink-muted flex items-center gap-1.5">
                            {f.file_size ? <span>{formatFileSize(f.file_size)}</span> : null}
                            {f.file_size && isImg ? <span>·</span> : null}
                            {isImg ? <span>Image</span> : null}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isImg && fUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewLightbox(fUrl)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-ink-muted hover:text-ink hover:bg-surface-hover shadow-2xs transition-colors cursor-pointer"
                            title="Preview image"
                          >
                            <ZoomIn className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {fUrl && (
                          <a
                            href={fUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-primary-600 hover:text-primary-700 hover:bg-surface-hover shadow-2xs transition-colors"
                            title="Open file"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setFileToDelete(f)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove file"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <input
              ref={catalogueInputRef}
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,.svg,.doc,.docx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv"
              className="hidden"
              onChange={(e) => {
                handleFilesUpload(e.target.files, "catalogue");
              }}
            />

            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  catalogueInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingCatalogue(true);
              }}
              onDragLeave={() => setIsDraggingCatalogue(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingCatalogue(false);
                handleFilesUpload(e.dataTransfer.files, "catalogue");
              }}
              onClick={() => catalogueInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed ${
                isDraggingCatalogue
                  ? "border-primary-500 bg-primary-50/50"
                  : "border-border-strong hover:border-primary-400 bg-surface/60 hover:bg-primary-50/30"
              } p-4 text-center transition-all group`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-600 group-hover:scale-105 transition-transform mb-1">
                <UploadCloud className="h-4 w-4" />
              </div>
              <p className="text-xs font-semibold text-ink">
                {catalogueFiles.length > 0 ? "+ Add more Catalogue files" : "Click or drag & drop Catalogue files"}
              </p>
              <p className="text-[10.5px] text-ink-muted mt-0.5">PDF, Excel, Images, Word docs up to 30MB</p>
            </div>
          </div>

          {/* Section 2: Rate List / Price Sheet */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-sunken/20 p-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-ink">Rate List / Price Sheet</h3>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-100">
                  {rateListFiles.length}
                </span>
              </div>
              <span className="text-[11px] text-ink-muted">Supplier quotes, price lists, sheets</span>
            </div>

            {rateListFiles.length > 0 && (
              <div className="flex flex-col gap-2">
                {rateListFiles.map((f, idx) => {
                  const fPath = f.file || f.file_url || "";
                  const fUrl = fPath ? (fPath.startsWith("data:") ? fPath : mediaUrl(fPath) || fPath) : "";
                  const fName = f.file_name || (fPath ? fPath.split("/").pop() : `Rate List File #${idx + 1}`);
                  const isImg = isImageFile(fName || fUrl);

                  return (
                    <div
                      key={f.id ? `f-rate-${f.id}` : `f-rate-new-${idx}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 transition-colors hover:border-emerald-300"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-sunken border border-border shadow-2xs">
                          {getFileIcon(fName || fUrl)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-ink" title={fName || undefined}>
                            {fName}
                          </p>
                          <p className="text-[10.5px] text-ink-muted flex items-center gap-1.5">
                            {f.file_size ? <span>{formatFileSize(f.file_size)}</span> : null}
                            {f.file_size && isImg ? <span>·</span> : null}
                            {isImg ? <span>Image</span> : null}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isImg && fUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewLightbox(fUrl)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-ink-muted hover:text-ink hover:bg-surface-hover shadow-2xs transition-colors cursor-pointer"
                            title="Preview image"
                          >
                            <ZoomIn className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {fUrl && (
                          <a
                            href={fUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-emerald-600 hover:text-emerald-700 hover:bg-surface-hover shadow-2xs transition-colors"
                            title="Open file"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setFileToDelete(f)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove file"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <input
              ref={rateListInputRef}
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,.svg,.doc,.docx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv"
              className="hidden"
              onChange={(e) => {
                handleFilesUpload(e.target.files, "rate_list");
              }}
            />

            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  rateListInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingRateList(true);
              }}
              onDragLeave={() => setIsDraggingRateList(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingRateList(false);
                handleFilesUpload(e.dataTransfer.files, "rate_list");
              }}
              onClick={() => rateListInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed ${
                isDraggingRateList
                  ? "border-emerald-500 bg-emerald-50/50"
                  : "border-border-strong hover:border-emerald-400 bg-surface/60 hover:bg-emerald-50/30"
              } p-4 text-center transition-all group`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform mb-1">
                <UploadCloud className="h-4 w-4" />
              </div>
              <p className="text-xs font-semibold text-ink">
                {rateListFiles.length > 0 ? "+ Add more Rate List files" : "Click or drag & drop Rate List files"}
              </p>
              <p className="text-[10.5px] text-ink-muted mt-0.5">Excel, Sheets, PDFs, Price lists up to 30MB</p>
            </div>
          </div>
        </div>

        {/* Overall Remarks / Notes */}
        <Field label="Overall Remarks / Notes (optional)">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any overall job notes or remarks..."
            rows={2}
            className="resize-y min-h-[52px]"
          />
        </Field>
      </Card>

      {error && <p className="text-[13px] font-medium text-primary-600">{error}</p>}

      <SlideOver
        open={quickAdd === "client"}
        onClose={() => setQuickAdd(null)}
        title="Add Client"
      >
        <ClientForm
          client={null}
          countries={countries}
          onCancel={() => setQuickAdd(null)}
          onSaved={(newClient) => {
            setQuickAdd(null);
            reloadClients();
            if (newClient?.id) {
              setClients((prev) => {
                if (prev.some((c) => c.id === newClient.id)) return prev;
                return [...prev, newClient];
              });
              setClient(newClient.id);
            }
          }}
        />
      </SlideOver>

      <SlideOver
        open={quickAdd === "supplier"}
        onClose={() => setQuickAdd(null)}
        title="Add Supplier"
      >
        <SupplierForm
          supplier={null}
          onCancel={() => setQuickAdd(null)}
          onSaved={(newSupplier) => {
            setQuickAdd(null);
            reloadSuppliers();
            if (newSupplier?.id) {
              setSuppliers((prev) => {
                if (prev.some((s) => s.id === newSupplier.id)) return prev;
                return [...prev, newSupplier];
              });
              setSupplier(newSupplier.id);
            }
          }}
        />
      </SlideOver>

      <ProductModal
        open={quickAdd === "product"}
        onClose={() => {
          setQuickAdd(null);
          setActiveProductRowIndex(null);
        }}
        title="Add Product"
        onSaved={(newProduct) => {
          setQuickAdd(null);
          reloadProducts();
          if (newProduct?.id) {
            setProducts((prev) => {
              if (prev.some((p) => p.id === newProduct.id)) return prev;
              return [...prev, newProduct];
            });
            if (activeProductRowIndex !== null) {
              updateItem(activeProductRowIndex, {
                product: newProduct.id,
                product_name: newProduct.product_name,
                description: newProduct.description || "",
              });
            }
          }
          setActiveProductRowIndex(null);
        }}
      />

      {previewLightbox && (
        <ImageLightboxModal
          open={Boolean(previewLightbox)}
          onClose={() => setPreviewLightbox(null)}
          images={[{ image: previewLightbox, caption: "Attached image" }]}
        />
      )}

      <ConfirmDialog
        open={confirmSaveOpen}
        onClose={() => setConfirmSaveOpen(false)}
        onConfirm={proceedSave}
        title={costing ? "Update Costing Sheet?" : "Save New Costing Sheet?"}
        description={
          costing
            ? "Are you sure you want to save all changes to this costing sheet?"
            : "Are you sure you want to create and save this new costing sheet?"
        }
        confirmLabel={costing ? "Yes, Update" : "Yes, Save"}
        loading={saving}
        variant="primary"
      />

      <ConfirmDialog
        open={Boolean(columnToDelete)}
        onClose={() => setColumnToDelete(null)}
        onConfirm={() => {
          if (columnToDelete) {
            removeColumn(columnToDelete.key);
            toast.success(`Removed column "${columnToDelete.label}".`);
            setColumnToDelete(null);
          }
        }}
        title="Remove Custom Column?"
        description={`Are you sure you want to remove the column "${columnToDelete?.label}" from this costing table?`}
        confirmLabel="Yes, Remove"
        variant="danger"
      />

      <ConfirmDialog
        open={Boolean(fileToDelete)}
        onClose={() => setFileToDelete(null)}
        onConfirm={() => {
          if (fileToDelete) {
            removeFile(fileToDelete);
            toast.success(`Removed "${fileToDelete.file_name || "file"}".`);
            setFileToDelete(null);
          }
        }}
        title="Remove Attached File?"
        description={`Are you sure you want to remove "${fileToDelete?.file_name || "this file"}"?`}
        confirmLabel="Yes, Remove"
        variant="danger"
      />
    </form>
  );
}
