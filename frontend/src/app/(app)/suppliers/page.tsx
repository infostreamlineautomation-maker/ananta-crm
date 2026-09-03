"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { usePaginatedList, useDebouncedValue } from "@/lib/hooks";
import { Supplier } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, RowActionButton } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/SlideOver";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";

import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";
import { FilterBar } from "@/components/ui/FilterBar";

const SUPPLIERS_PAGE_COLUMNS: ColumnDef[] = [
  { key: "supplier_name", label: "Supplier Name", required: true },
  { key: "owner_name_contact", label: "Owner / Contact" },
  { key: "contact", label: "Contact Phone" },
  { key: "source", label: "Source" },
  { key: "email", label: "Email" },
  { key: "actions", label: "Actions", required: true },
];

export default function SuppliersPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [cols, setCols] = useState<Set<string>>(new Set(SUPPLIERS_PAGE_COLUMNS.map((c) => c.key)));
  const debouncedSearch = useDebouncedValue(search);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    params.set("page", String(page));
    return `/api/suppliers/?${params.toString()}`;
  }, [debouncedSearch, page]);

  const { data, loading, reload } = usePaginatedList<Supplier>(path);

  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);

  const canAdd = can("suppliers", "add");
  const canEdit = can("suppliers", "edit");
  const canDelete = can("suppliers", "delete");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Suppliers"
        action={
          canAdd && (
            <Button variant="primary" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> Add Supplier
            </Button>
          )
        }
      />

      <FilterBar
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Search suppliers by name, email, phone..."
        filters={[]}
        activeFilters={{}}
        onFilterChange={() => {}}
        onReset={() => {
          setSearch("");
          setPage(1);
        }}
        actions={<ColumnSelector columns={SUPPLIERS_PAGE_COLUMNS} visibleColumns={cols} onChange={setCols} />}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {cols.has("supplier_name") && <th className={TH}>Supplier Name</th>}
                {cols.has("owner_name_contact") && <th className={TH}>Owner / Contact</th>}
                {cols.has("contact") && <th className={TH}>Number</th>}
                {cols.has("source") && <th className={TH}>Source</th>}
                {cols.has("email") && <th className={TH}>Email</th>}
                {cols.has("actions") && <th className={TH}></th>}
              </tr>
            </thead>
            <tbody>
              <TableState loading={loading} empty={!loading && (data?.results.length ?? 0) === 0} colSpan={cols.size} emptyLabel="No suppliers yet." />
              {data?.results.map((s) => (
                <tr key={s.id} className={TR}>
                  {cols.has("supplier_name") && (
                    <td className={TD}>
                      <Link href={`/suppliers/${s.id}`} className="font-semibold text-ink hover:text-primary-500">
                        {s.supplier_name}
                      </Link>
                    </td>
                  )}
                  {cols.has("owner_name_contact") && <td className={`${TD} text-ink-muted`}>{s.owner_name_contact || "—"}</td>}
                  {cols.has("contact") && <td className={`${TD} text-ink-muted`}>{s.contact || "—"}</td>}
                  {cols.has("source") && <td className={`${TD} text-ink-muted`}>{s.source || "—"}</td>}
                  {cols.has("email") && <td className={`${TD} text-ink-muted`}>{s.email || "—"}</td>}
                  {cols.has("actions") && (
                    <td className={`${TD} text-right`}>
                      <div className="flex justify-end gap-1">
                        {canEdit && (
                          <RowActionButton label="Edit" onClick={() => setEditing(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </RowActionButton>
                        )}
                        {canDelete && (
                          <RowActionButton label="Delete" tone="danger" onClick={() => setDeleting(s)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </RowActionButton>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && <Pagination count={data.count} page={page} onPageChange={setPage} />}
      </Card>

      <SlideOver open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add Supplier" : "Edit Supplier"}>
        {editing !== null && (
          <SupplierForm
            key={editing === "new" ? "new" : editing.id}
            supplier={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </SlideOver>

      {deleting && (
        <ConfirmDialog
          open
          onClose={() => setDeleting(null)}
          title="Delete supplier"
          description={`Delete "${deleting.supplier_name}"? This can be undone later from the archive.`}
          onConfirm={async () => {
            try {
              await apiFetch(`/api/suppliers/${deleting.id}/`, { method: "DELETE" });
              toast.success("Supplier deleted.");
              setDeleting(null);
              reload();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Couldn't delete this supplier.");
            }
          }}
        />
      )}
    </div>
  );
}

export function SupplierForm({
  supplier,
  onCancel,
  onSaved,
}: {
  supplier: Supplier | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    supplier_name: supplier?.supplier_name ?? "",
    owner_name_contact: supplier?.owner_name_contact ?? "",
    contact: supplier?.contact ?? "",
    source: supplier?.source ?? "",
    email: supplier?.email ?? "",
    website: supplier?.website ?? "",
    address: supplier?.address ?? "",
    remark: supplier?.remark ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (supplier) {
        await apiFetch(`/api/suppliers/${supplier.id}/`, { method: "PATCH", body: JSON.stringify(form) });
        toast.success("Supplier updated.");
      } else {
        await apiFetch("/api/suppliers/", { method: "POST", body: JSON.stringify(form) });
        toast.success("Supplier added.");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this supplier.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Supplier Name" required>
        <Input value={form.supplier_name} onChange={(e) => set("supplier_name", e.target.value)} required autoFocus />
      </Field>
      <Field label="Owner / Contact Name">
        <Input value={form.owner_name_contact} onChange={(e) => set("owner_name_contact", e.target.value)} />
      </Field>
      <Field label="Contact Number">
        <Input value={form.contact} onChange={(e) => set("contact", e.target.value)} />
      </Field>
      <Field label="Source">
        <Input value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="e.g. IndiaMART, referral" />
      </Field>
      <Field label="Email">
        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label="Website">
        <Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://..." />
      </Field>
      <Field label="Address">
        <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} />
      </Field>
      <Field label="Remark">
        <Textarea value={form.remark} onChange={(e) => set("remark", e.target.value)} />
      </Field>

      {error && <p className="text-[13px] font-medium text-primary-600">{error}</p>}

      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Save Supplier
        </Button>
      </div>
    </form>
  );
}
