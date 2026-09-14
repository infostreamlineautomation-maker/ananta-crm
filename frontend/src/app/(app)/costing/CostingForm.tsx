"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Calculator,
  Download,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Receipt,
  Trash2,
  UploadCloud,
  X,
  ZoomIn,
} from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useList } from "@/lib/hooks";
import {
  Client,
  CostingDetail,
  CostingFile,
  Product,
  QuotationColumn,
  Supplier,
} from "@/lib/types";
import { formatCurrency, mediaUrl } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Combobox } from "@/components/ui/Combobox";
import { QuickCreateModal } from "@/components/ui/QuickCreateModal";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";

let columnCounter = 0;
function newColumnKey() {
  columnCounter += 1;
  return `custom_${Date.now()}_${columnCounter}`;
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
  const toast = useToast();

  const { items: rawSuppliers } = useList<Supplier>("/api/suppliers/?page_size=200");
  const { items: rawProducts } = useList<Product>("/api/products/?page_size=200");
  const { items: rawClients } = useList<Client>("/api/clients/?page_size=200");

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
  const [supplier, setSupplier] = useState<number | "">(costing?.supplier ?? "");
  const [product, setProduct] = useState<number | "">(costing?.product ?? "");
  const [client, setClient] = useState<number | "">(costing?.client ?? "");

  // Single inline fields (just like project form)
  const [supplierRate, setSupplierRate] = useState<string>(costing?.items?.[0]?.supplier_rate ?? "0");
  const [quantity, setQuantity] = useState<string>(costing?.items?.[0]?.quantity ?? "1");
  const [clientRate, setClientRate] = useState<string>(costing?.items?.[0]?.client_rate ?? "0");
  const [extraData, setExtraData] = useState<Record<string, string>>(costing?.items?.[0]?.extra_data ?? {});

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

  const [description, setDescription] = useState(costing?.description ?? "");
  const [columns, setColumns] = useState<QuotationColumn[]>(costing?.columns_config ?? []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supplierOptions = suppliers.map((s) => ({
    value: s.id,
    label: s.rating ? `${s.supplier_name} (Grade ${s.rating})` : s.supplier_name,
    sublabel: s.company_name ? `${s.company_name}${s.rating ? ` · Grade ${s.rating}` : ""}` : s.rating ? `Grade ${s.rating} Supplier` : undefined,
  }));
  const productOptions = products.map((p) => ({ value: p.id, label: p.product_name }));
  const clientOptions = clients.map((c) => ({ value: c.id, label: c.client_name }));

  const totals = useMemo(() => {
    const sRate = parseFloat(supplierRate) || 0;
    const qty = parseFloat(quantity) || 0;
    const cRate = parseFloat(clientRate) || 0;
    const supplierCost = sRate * qty;
    const clientRevenue = cRate * qty;
    const profit = clientRevenue - supplierCost;
    const profitPercent = supplierCost ? (profit / supplierCost) * 100 : 0;
    return { supplierCost, clientRevenue, profit, profitPercent };
  }, [supplierRate, quantity, clientRate]);

  function addColumn() {
    const col = { key: newColumnKey(), label: "New Field" };
    setColumns((prev) => [...prev, col]);
  }

  function removeColumn(key: string) {
    setColumns((prev) => prev.filter((c) => c.key !== key));
    setExtraData((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
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
        supplier,
        product,
        client,
        files: files.map((f) => ({
          id: f.id,
          file: f.file,
          file_name: f.file_name,
          file_size: f.file_size,
          category: f.category || "catalogue",
        })),
        file: files.length > 0 ? files[0].file : null,
        file_name: files.length > 0 ? files[0].file_name : null,
        description,
        columns_config: columns,
        items: [
          {
            supplier_rate: supplierRate || "0",
            quantity: quantity || "1",
            client_rate: clientRate || "0",
            extra_data: extraData || {},
          },
        ],
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

  const catalogueFiles = useMemo(() => files.filter((f) => f.category !== "rate_list"), [files]);
  const rateListFiles = useMemo(() => files.filter((f) => f.category === "rate_list"), [files]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold text-ink">{costing ? "Edit Costing Sheet" : "New Costing Sheet"}</h1>
        <Button type="submit" variant="primary" loading={saving}>
          Save
        </Button>
      </div>

      <Card className="flex flex-col gap-5 p-5">
        {/* Basic Information */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <Field label="Product / Item" required hint="Pick existing or add new">
            <Combobox
              value={product || null}
              onChange={(v) => setProduct(Number(v))}
              options={productOptions}
              placeholder="Select product..."
              onAddNew={() => setQuickAdd("product")}
              addNewLabel="Add new product"
            />
          </Field>
        </div>

        {/* Single Inline Section: Rates & Margin Calculation */}
        <div className="rounded-xl border border-border bg-surface-sunken/20 p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary-600" />
              <h2 className="text-sm font-bold text-ink">Rates &amp; Quantity</h2>
            </div>
            <button
              type="button"
              onClick={addColumn}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add Custom Field
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Supplier Rate (Cost per unit)" required>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={supplierRate}
                onChange={(e) => setSupplierRate(e.target.value)}
                placeholder="0.00"
                required
              />
            </Field>
            <Field label="Quantity" required>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1.00"
                required
              />
            </Field>
            <Field label="Client Rate (Charge per unit)" required>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={clientRate}
                onChange={(e) => setClientRate(e.target.value)}
                placeholder="0.00"
                required
              />
            </Field>
          </div>

          {/* Dynamic Extra Custom Fields */}
          {columns.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 border-t border-border/60 pt-3">
              {columns.map((col) => (
                <div key={col.key} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Field label={col.label}>
                      <Input
                        type="text"
                        value={extraData[col.key] || ""}
                        onChange={(e) =>
                          setExtraData((prev) => ({
                            ...prev,
                            [col.key]: e.target.value,
                          }))
                        }
                        placeholder={`Enter ${col.label.toLowerCase()}...`}
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeColumn(col.key)}
                    className="mb-1 rounded p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600 cursor-pointer transition-colors"
                    title="Remove custom field"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Real-time Calculation Breakdown Bar */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/80 bg-surface p-3.5 sm:grid-cols-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Supplier Total Cost</span>
              <p className="tnum text-base font-extrabold text-ink mt-0.5">{formatCurrency(totals.supplierCost)}</p>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Client Total Revenue</span>
              <p className="tnum text-base font-extrabold text-ink mt-0.5">{formatCurrency(totals.clientRevenue)}</p>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Net Profit</span>
              <p
                className={`tnum text-base font-extrabold mt-0.5 ${
                  totals.profit >= 0 ? "text-success-700" : "text-primary-600"
                }`}
              >
                {formatCurrency(totals.profit)}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Profit Margin (%)</span>
              <span
                className={`mt-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11.5px] font-bold ${
                  totals.profitPercent >= 20 ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"
                }`}
              >
                {totals.profitPercent.toFixed(1)}%
              </span>
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

            {/* List of catalogue files */}
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
                            download={fName || "catalogue-file"}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-primary-600 hover:text-primary-700 hover:bg-surface-hover shadow-2xs transition-colors"
                            title="Download / Open file"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(f)}
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

            {/* Hidden file input for catalogue */}
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

            {/* Dropzone for catalogue */}
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

            {/* List of rate list files */}
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
                            download={fName || "ratelist-file"}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-emerald-600 hover:text-emerald-700 hover:bg-surface-hover shadow-2xs transition-colors"
                            title="Download / Open file"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(f)}
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

            {/* Hidden file input for rate list */}
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

            {/* Dropzone for rate list */}
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

        {/* Description / Remarks */}
        <Field label="Job Title / Description / Remarks (optional)">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any job specifications, remarks or notes..."
            rows={2}
          />
        </Field>
      </Card>

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

      {previewLightbox && (
        <ImageLightboxModal
          open={Boolean(previewLightbox)}
          onClose={() => setPreviewLightbox(null)}
          images={[{ image: previewLightbox, caption: "Attached image" }]}
        />
      )}
    </form>
  );
}
