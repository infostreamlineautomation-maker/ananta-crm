"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileText,
  Globe,
  Loader2,
  Mail,
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
import { SlideOver } from "@/components/ui/SlideOver";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { Combobox } from "@/components/ui/Combobox";
import { RowActionButton } from "@/components/ui/PageHeader";
import { SupplierForm } from "../page";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "contacts", label: "Contacts" },
  { key: "products", label: "Products" },
  { key: "files", label: "Files" },
  { key: "activity", label: "Activity Log" },
];

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const supplierId = Number(params.id);
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);

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

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "overview" && <OverviewTab supplier={supplier} />}
      {tab === "contacts" && <ContactsTab supplier={supplier} onChange={loadSupplier} />}
      {tab === "products" && <ProductsTab supplier={supplier} onChange={loadSupplier} />}
      {tab === "files" && <FilesTab supplier={supplier} onChange={loadSupplier} />}
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
    ["Owner / Contact Name", supplier.owner_name_contact || "—"],
    ["Source", supplier.source || "—"],
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

function ContactForm({ supplierId, onCancel, onSaved }: { supplierId: number; onCancel: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [designation, setDesignation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/supplier-contacts/", {
        method: "POST",
        body: JSON.stringify({ supplier: supplierId, contact_name: name, contact_number: number, designation }),
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
      <Field label="Contact Name" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </Field>
      <Field label="Contact Number">
        <Input value={number} onChange={(e) => setNumber(e.target.value)} />
      </Field>
      <Field label="Designation">
        <Input value={designation} onChange={(e) => setDesignation(e.target.value)} />
      </Field>
      {error && <p className="text-[13px] font-medium text-primary-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Add Contact
        </Button>
      </div>
    </form>
  );
}

function ProductsTab({ supplier, onChange }: { supplier: Supplier; onChange: () => void }) {
  const toast = useToast();
  const { can } = useAuth();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [picking, setPicking] = useState<number | "">("");
  const [adding, setAdding] = useState(false);
  const canEdit = can("suppliers", "edit");
  const canDelete = can("suppliers", "delete");

  useEffect(() => {
    apiFetch<Paginated<Product>>("/api/products/?page_size=200")
      .then((res) => setAllProducts(res.results))
      .catch(() => {});
  }, []);

  const linkedIds = new Set(supplier.supplier_products.map((sp) => sp.product));
  const options = allProducts.filter((p) => !linkedIds.has(p.id)).map((p) => ({ value: p.id, label: p.product_name }));

  async function addProduct(productId: number | string) {
    setAdding(true);
    try {
      await apiFetch("/api/supplier-products/", {
        method: "POST",
        body: JSON.stringify({ supplier: supplier.id, product: productId }),
      });
      toast.success("Product linked.");
      setPicking("");
      onChange();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't link this product.");
    } finally {
      setAdding(false);
    }
  }

  async function removeProduct(sp: SupplierProduct) {
    try {
      await apiFetch(`/api/supplier-products/${sp.id}/`, { method: "DELETE" });
      toast.success("Product unlinked.");
      onChange();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't unlink this product.");
    }
  }

  return (
    <Card>
      {canEdit && (
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <div className="w-64">
            <Combobox value={picking || null} onChange={addProduct} options={options} placeholder="Link a product..." disabled={adding} />
          </div>
          {adding && <Loader2 className="h-4 w-4 animate-spin text-ink-faint" />}
        </div>
      )}
      {supplier.supplier_products.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-faint">No products linked yet.</p>}
      <div className="divide-y divide-border">
        {supplier.supplier_products.map((sp) => (
          <div key={sp.id} className="flex items-center justify-between px-5 py-3">
            <span className="text-[13.5px] font-medium text-ink">{sp.product_name}</span>
            {canDelete && (
              <RowActionButton label="Unlink" tone="danger" onClick={() => removeProduct(sp)}>
                <Trash2 className="h-3.5 w-3.5" />
              </RowActionButton>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

const FILE_TYPE_LABEL: Record<string, string> = { brochure: "Brochure", rate_card: "Rate Card" };

function FilesTab({ supplier, onChange }: { supplier: Supplier; onChange: () => void }) {
  const toast = useToast();
  const { can } = useAuth();
  const [fileType, setFileType] = useState("brochure");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<SupplierFile | null>(null);
  const canEdit = can("suppliers", "edit");
  const canDelete = can("suppliers", "delete");

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("supplier", String(supplier.id));
      body.append("file_type", fileType);
      body.append("file", file);
      await apiFetch("/api/supplier-files/", { method: "POST", body });
      toast.success("File uploaded.");
      onChange();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't upload this file.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      {canEdit && (
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <Select value={fileType} onChange={(e) => setFileType(e.target.value)} className="w-40">
            <option value="brochure">Brochure</option>
            <option value="rate_card">Rate Card</option>
          </Select>
          <label className="flex h-10 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-white px-3 text-[13px] font-semibold text-ink hover:bg-surface-hover">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Uploading..." : "Upload file"}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
          </label>
          <span className="text-[12px] text-ink-faint">PDF, JPG, PNG, XLS — max 10MB</span>
        </div>
      )}
      {supplier.files.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-faint">No files uploaded yet.</p>}
      <div className="divide-y divide-border">
        {supplier.files.map((f) => (
          <div key={f.id} className="flex items-center gap-3 px-5 py-3">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-surface-sunken text-ink-faint">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-ink">{f.file.split("/").pop()}</p>
              <p className="text-[12px] text-ink-faint">
                {FILE_TYPE_LABEL[f.file_type]} · {(f.file_size / 1024).toFixed(0)} KB · {formatDate(f.uploaded_at)}
              </p>
            </div>
            <a href={f.file} target="_blank" rel="noreferrer" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-surface-sunken hover:text-ink">
              <Download className="h-3.5 w-3.5" />
            </a>
            {canDelete && (
              <RowActionButton label="Delete" tone="danger" onClick={() => setDeleting(f)}>
                <Trash2 className="h-3.5 w-3.5" />
              </RowActionButton>
            )}
          </div>
        ))}
      </div>

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
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Paginated<ActivityLogEntry>>(`/api/activity-log/?module=suppliers&object_id=${supplierId}&page_size=50`)
      .then((res) => setEntries(res.results))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [supplierId]);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />
      </div>
    );
  }

  return (
    <Card>
      {entries.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-faint">No activity recorded yet.</p>}
      <div className="divide-y divide-border">
        {entries.map((e) => (
          <div key={e.id} className="flex items-start gap-3 px-5 py-3">
            <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-primary-500" />
            <p className="text-[13.5px] text-ink">
              <span className="font-semibold">{e.user_name || "System"}</span> {e.action}
              {e.details && <span className="text-ink-muted"> — {e.details}</span>}
              <span className="ml-2 text-[12px] text-ink-faint">{formatDate(e.created_at)}</span>
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
