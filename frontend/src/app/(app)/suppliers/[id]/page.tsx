"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileText,
  Globe,
  Loader2,
  Mail,
  Package,
  Phone,
  Plus,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError, Paginated } from "@/lib/api";
import { ActivityLogEntry, Product, Supplier, SupplierContact, SupplierFile, SupplierProduct } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { LoadingState } from "@/components/ui/LoadingState";
import { ActivityTimeline } from "@/components/ui/ActivityTimeline";
import { SlideOver } from "@/components/ui/SlideOver";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { Combobox } from "@/components/ui/Combobox";
import { RowActionButton } from "@/components/ui/PageHeader";
import { ProductModal } from "@/components/products/ProductModal";
import { SupplierForm } from "../page";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "contacts", label: "Contacts" },
  { key: "products", label: "Products" },
  { key: "quotations", label: "Quotations" },
  { key: "rate_cards", label: "Rate Cards" },
  { key: "activity", label: "Activity Log" },
];

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const supplierId = Number(params.id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { can } = useAuth();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const urlTab = searchParams.get("tab");
  const initialTab =
    urlTab === "files"
      ? "quotations"
      : urlTab && TABS.some((t) => t.key === urlTab)
      ? urlTab
      : "overview";
  const [tab, setTab] = useState(initialTab);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const qTab = searchParams.get("tab");
    if (qTab === "files") {
      setTab("quotations");
    } else if (qTab && TABS.some((t) => t.key === qTab)) {
      setTab(qTab);
    }
  }, [searchParams]);

  function handleTabChange(newTab: string) {
    setTab(newTab);
    router.replace(`/suppliers/${supplierId}?tab=${newTab}`, { scroll: false });
  }

  async function loadSupplier() {
    try {
      const s = await apiFetch<Supplier>(`/api/suppliers/${supplierId}/`);
      setSupplier(s);
    } catch {
      toast.error("Couldn't load this supplier.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSupplier();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingState size="lg" label="Loading Supplier Profile..." sublabel="Fetching purchase & product history" />
      </div>
    );
  }

  if (!supplier) {
    return <p className="text-sm text-ink-faint">Supplier not found.</p>;
  }

  const canEdit = can("suppliers", "edit");

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => router.push("/suppliers")} className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Suppliers
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{supplier.supplier_name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
            {supplier.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {supplier.email}
              </span>
            )}
            {supplier.contact && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> {supplier.contact}
              </span>
            )}
            {supplier.website && (
              <span className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" /> {supplier.website}
              </span>
            )}
          </div>
        </div>
        {canEdit && (
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        )}
      </div>

      <Tabs tabs={TABS} active={tab} onChange={handleTabChange} />

      {tab === "overview" && <OverviewTab supplier={supplier} />}
      {tab === "contacts" && <ContactsTab supplier={supplier} onChange={loadSupplier} />}
      {tab === "products" && <ProductsTab supplier={supplier} onChange={loadSupplier} />}
      {(tab === "quotations" || tab === "files") && (
        <SupplierDocumentsTab
          supplier={supplier}
          fileType="quotation"
          title="Supplier Quotations"
          description="Upload and manage price quotations, proposals, and cost estimates provided by this supplier."
          onChange={loadSupplier}
        />
      )}
      {tab === "rate_cards" && (
        <SupplierDocumentsTab
          supplier={supplier}
          fileType="rate_card"
          title="Rate Cards & Price Lists"
          description="Upload and manage formal rate lists, job-work price sheets, and material cost cards."
          onChange={loadSupplier}
        />
      )}
      {tab === "activity" && <ActivityTab supplierId={supplierId} />}

      <SlideOver open={editOpen} onClose={() => setEditOpen(false)} title="Edit Supplier">
        <SupplierForm
          supplier={supplier}
          onCancel={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            loadSupplier();
          }}
        />
      </SlideOver>
    </div>
  );
}

function OverviewTab({ supplier }: { supplier: Supplier }) {
  const rows: [string, string][] = [
    ["Company Name", supplier.company_name || supplier.owner_name_contact || "—"],
    ["Source / Origin", supplier.source || "—"],
    ["Address", supplier.address || "—"],
    ["Remark", supplier.remark || "—"],
  ];
  return (
    <Card className="divide-y divide-border">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-3 gap-4 px-5 py-3.5">
          <span className="text-[13px] font-semibold text-ink-muted">{label}</span>
          <span className="col-span-2 text-[13.5px] text-ink">{value}</span>
        </div>
      ))}
    </Card>
  );
}

function ContactsTab({ supplier, onChange }: { supplier: Supplier; onChange: () => void }) {
  const toast = useToast();
  const { can } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<SupplierContact | null>(null);
  const canEdit = can("suppliers", "edit");
  const canDelete = can("suppliers", "delete");

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <span className="text-[13px] font-semibold text-ink-muted">{supplier.contacts.length} contact{supplier.contacts.length === 1 ? "" : "s"}</span>
        {canEdit && (
          <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Contact
          </Button>
        )}
      </div>
      {supplier.contacts.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-faint">No contacts added yet.</p>}
      <div className="divide-y divide-border">
        {supplier.contacts.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-5 py-3">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface-sunken text-ink-faint">
              <User className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-ink">{c.contact_name}</p>
              <p className="text-[12px] text-ink-faint">
                {c.contact_number || "—"} {c.designation && `· ${c.designation}`}
              </p>
            </div>
            {canDelete && (
              <RowActionButton label="Delete" tone="danger" onClick={() => setDeleting(c)}>
                <Trash2 className="h-3.5 w-3.5" />
              </RowActionButton>
            )}
          </div>
        ))}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Contact" width="max-w-sm">
        <ContactForm
          supplierId={supplier.id}
          onCancel={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            onChange();
          }}
        />
      </Modal>

      {deleting && (
        <ConfirmDialog
          open
          onClose={() => setDeleting(null)}
          title="Remove contact"
          description={`Remove "${deleting.contact_name}" from this supplier?`}
          confirmLabel="Remove"
          onConfirm={async () => {
            try {
              await apiFetch(`/api/supplier-contacts/${deleting.id}/`, { method: "DELETE" });
              toast.success("Contact removed.");
              setDeleting(null);
              onChange();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Couldn't remove this contact.");
            }
          }}
        />
      )}
    </Card>
  );
}

function ContactForm({
  supplierId,
  onCancel,
  onSaved,
}: {
  supplierId: number;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ contact_name: "", contact_number: "", designation: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/supplier-contacts/", {
        method: "POST",
        body: JSON.stringify({ ...form, supplier: supplierId }),
      });
      toast.success("Contact added.");
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't add this contact.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Contact Person Name" required>
        <Input
          value={form.contact_name}
          onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
          required
          autoFocus
          placeholder="e.g. Priyanshu"
        />
      </Field>
      <Field label="Phone / Mobile Number">
        <Input
          value={form.contact_number}
          onChange={(e) => setForm((f) => ({ ...f, contact_number: e.target.value }))}
          placeholder="+91 9876543210"
        />
      </Field>
      <Field label="Designation / Role">
        <Input
          value={form.designation}
          onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
          placeholder="e.g. Sales Manager, Accounts"
        />
      </Field>
      {error && <p className="text-[13px] font-medium text-primary-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Save Contact
        </Button>
      </div>
    </form>
  );
}

function ProductsTab({ supplier, onChange }: { supplier: Supplier; onChange: () => void }) {
  const toast = useToast();
  const { can } = useAuth();
  const [picking, setPicking] = useState<number | "">("");
  const [adding, setAdding] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [unlinking, setUnlinking] = useState<SupplierProduct | null>(null);

  const canEdit = can("suppliers", "edit");
  const canDelete = can("suppliers", "delete");
  const canAddProduct = can("catalog", "add");

  useEffect(() => {
    apiFetch<Paginated<Product>>("/api/products/?page_size=200")
      .then((res) => setAllProducts(res.results || []))
      .catch(() => {});
  }, []);

  const linkedIds = new Set(supplier.supplier_products.map((sp) => sp.product));
  const available = allProducts.filter((p) => !linkedIds.has(p.id));
  const options = available.map((p) => ({ value: p.id, label: p.product_name }));

  async function addProduct(productId: number | string) {
    const id = Number(productId);
    if (!id) return;
    setAdding(true);
    try {
      await apiFetch("/api/supplier-products/", {
        method: "POST",
        body: JSON.stringify({ supplier: supplier.id, product: id }),
      });
      toast.success("Product linked to supplier.");
      setPicking("");
      onChange();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't link this product.");
    } finally {
      setAdding(false);
    }
  }

  async function handleProductCreated(newProduct: Product) {
    setAllProducts((prev) => [...prev, newProduct]);
    try {
      await apiFetch("/api/supplier-products/", {
        method: "POST",
        body: JSON.stringify({ supplier: supplier.id, product: newProduct.id }),
      });
      toast.success(`"${newProduct.product_name}" created and linked.`);
      onChange();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Product created, but couldn't link it automatically.");
    }
  }

  async function removeProduct(sp: SupplierProduct) {
    try {
      await apiFetch(`/api/supplier-products/${sp.id}/`, { method: "DELETE" });
      toast.success("Product unlinked.");
      setUnlinking(null);
      onChange();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't unlink this product.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-ink">
              Linked Products ({supplier.supplier_products.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <div className="w-56">
                <Combobox
                  value={picking || null}
                  onChange={addProduct}
                  options={options}
                  placeholder="Link existing product..."
                  disabled={adding}
                />
              </div>
            )}
            {canAddProduct && (
              <Button size="sm" variant="primary" onClick={() => setCreateProductOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add New Product
              </Button>
            )}
          </div>
        </div>

        {supplier.supplier_products.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Package className="mx-auto h-8 w-8 text-ink-faint" />
            <p className="mt-2 text-sm font-semibold text-ink">No products linked yet</p>
            <p className="mt-1 text-xs text-ink-muted">
              Link catalog products that this supplier manufactures or supplies.
            </p>
            {canAddProduct && (
              <div className="mt-4 flex justify-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => setCreateProductOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Create & Link Product
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {supplier.supplier_products.map((sp) => (
              <div key={sp.id} className="flex items-start justify-between gap-4 px-5 py-3.5 hover:bg-surface-hover transition">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[13.5px] text-ink">{sp.product_name}</span>
                  </div>

                  {sp.product_description && (
                    <p className="mt-1 text-[12.5px] text-ink-muted whitespace-pre-line line-clamp-2">
                      {sp.product_description}
                    </p>
                  )}

                  {sp.product_extra_data && Object.keys(sp.product_extra_data).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(sp.product_extra_data).map(([key, val]) =>
                        val ? (
                          <span
                            key={key}
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-sunken text-ink border border-border"
                          >
                            <span className="text-ink-faint mr-1 capitalize">{key.replace(/_/g, " ")}:</span>
                            <span>{String(val)}</span>
                          </span>
                        ) : null
                      )}
                    </div>
                  )}
                </div>

                {canDelete && (
                  <RowActionButton
                    label="Unlink"
                    tone="danger"
                    onClick={() => setUnlinking(sp)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </RowActionButton>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <ProductModal
        open={createProductOpen}
        onClose={() => setCreateProductOpen(false)}
        onSaved={handleProductCreated}
      />

      {unlinking && (
        <ConfirmDialog
          open
          onClose={() => setUnlinking(null)}
          title="Unlink Product"
          description={`Unlink "${unlinking.product_name}" from this supplier? The product will remain in your product catalog.`}
          confirmLabel="Unlink"
          onConfirm={() => removeProduct(unlinking)}
        />
      )}
    </div>
  );
}

function SupplierDocumentsTab({
  supplier,
  fileType,
  title,
  description,
  onChange,
}: {
  supplier: Supplier;
  fileType: "quotation" | "rate_card";
  title: string;
  description: string;
  onChange: () => void;
}) {
  const toast = useToast();
  const { can } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<SupplierFile | null>(null);
  const canEdit = can("suppliers", "edit");
  const canDelete = can("suppliers", "delete");

  // Filter files belonging to this specific type (with backward compat for legacy "brochure")
  const matchingFiles = supplier.files.filter((f) =>
    fileType === "quotation"
      ? f.file_type === "quotation" || f.file_type === "brochure"
      : f.file_type === "rate_card"
  );

  async function handleMultipleUpload(files: FileList | File[]) {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("supplier", String(supplier.id));
      body.append("file_type", fileType);
      fileArray.forEach((f) => body.append("files", f));
      await apiFetch("/api/supplier-files/bulk_upload/", { method: "POST", body });
      toast.success(`${fileArray.length} ${fileType === "quotation" ? "quotation" : "rate card"} file(s) uploaded successfully.`);
      onChange();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't upload files.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-bold text-ink">{title}</h3>
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-semibold text-ink-muted">
              {matchingFiles.length}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
        </div>

        {canEdit && (
          <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary-500 hover:bg-primary-600 px-3.5 text-xs font-bold text-white shadow-xs transition">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Uploading files..." : `Upload ${fileType === "quotation" ? "Quotations" : "Rate Cards"}`}
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleMultipleUpload(e.target.files);
                }
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      {matchingFiles.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <FileText className="mx-auto h-9 w-9 text-ink-faint/60" />
          <p className="mt-2 text-sm font-semibold text-ink">No {fileType === "quotation" ? "quotations" : "rate cards"} uploaded yet</p>
          <p className="mt-1 text-xs text-ink-muted">
            You can upload multiple PDFs, images, or Excel sheets at once.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {matchingFiles.map((f) => {
            const fileName = f.file.split("/").pop() || "Document";
            const ext = fileName.split(".").pop()?.toUpperCase() || "FILE";
            return (
              <div key={f.id} className="flex items-center gap-3.5 px-5 py-3 hover:bg-surface-hover transition">
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-primary-50 text-primary-700 font-bold text-[11px] border border-primary-100">
                  {ext.slice(0, 4)}
                </div>
                <div className="min-w-0 flex-1">
                  <a
                    href={f.file}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-[13.5px] font-semibold text-ink hover:text-primary-600 transition block"
                  >
                    {fileName}
                  </a>
                  <p className="text-[12px] text-ink-faint mt-0.5">
                    {(f.file_size / 1024).toFixed(0)} KB · Uploaded {formatDate(f.uploaded_at)}
                    {f.uploaded_by_name && ` by ${f.uploaded_by_name}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={f.file}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink transition"
                    title="Download / View"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  {canDelete && (
                    <RowActionButton label="Delete" tone="danger" onClick={() => setDeleting(f)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </RowActionButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          open
          onClose={() => setDeleting(null)}
          title="Delete file"
          description={`Delete "${deleting.file.split("/").pop()}"?`}
          onConfirm={async () => {
            try {
              await apiFetch(`/api/supplier-files/${deleting.id}/`, { method: "DELETE" });
              toast.success("File deleted.");
              setDeleting(null);
              onChange();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Couldn't delete this file.");
            }
          }}
        />
      )}
    </Card>
  );
}

function ActivityTab({ supplierId }: { supplierId: number }) {
  return (
    <ActivityTimeline
      endpoint={`/api/activity-logs/?module=suppliers&object_id=${supplierId}`}
      title="Supplier History & Activity Timeline"
    />
  );
}
