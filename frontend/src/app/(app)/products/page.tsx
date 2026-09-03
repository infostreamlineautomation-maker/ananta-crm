"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { usePaginatedList, useDebouncedValue } from "@/lib/hooks";
import { Product } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, RowActionButton } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";

export default function ProductsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    params.set("page", String(page));
    return `/api/products/?${params.toString()}`;
  }, [debouncedSearch, page]);

  const { data, loading, reload } = usePaginatedList<Product>(path);

  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const canAdd = can("catalog", "add");
  const canEdit = can("catalog", "edit");
  const canDelete = can("catalog", "delete");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Products"
        action={
          canAdd && (
            <Button variant="primary" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          )
        }
      />

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search products..."
          className="pl-9"
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className={TH}>Product Name</th>
                <th className={TH}>Description</th>
                <th className={TH}></th>
              </tr>
            </thead>
            <tbody>
              <TableState loading={loading} empty={!loading && (data?.results.length ?? 0) === 0} colSpan={3} emptyLabel="No products yet." />
              {data?.results.map((p) => (
                <tr key={p.id} className={TR}>
                  <td className={`${TD} font-semibold`}>{p.product_name}</td>
                  <td className={`${TD} max-w-md truncate text-ink-muted`}>{p.description || "—"}</td>
                  <td className={`${TD} text-right`}>
                    <div className="flex justify-end gap-1">
                      {canEdit && (
                        <RowActionButton label="Edit" onClick={() => setEditing(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </RowActionButton>
                      )}
                      {canDelete && (
                        <RowActionButton label="Delete" tone="danger" onClick={() => setDeleting(p)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </RowActionButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && <Pagination count={data.count} page={page} onPageChange={setPage} />}
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add Product" : "Edit Product"}>
        {editing !== null && (
          <ProductForm
            key={editing === "new" ? "new" : editing.id}
            product={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </Modal>

      {deleting && (
        <ConfirmDialog
          open
          onClose={() => setDeleting(null)}
          title="Delete product"
          description={`Delete "${deleting.product_name}"? This can be undone later from the archive.`}
          onConfirm={async () => {
            try {
              await apiFetch(`/api/products/${deleting.id}/`, { method: "DELETE" });
              toast.success("Product deleted.");
              setDeleting(null);
              reload();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Couldn't delete this product.");
            }
          }}
        />
      )}
    </div>
  );
}

function ProductForm({
  product,
  onCancel,
  onSaved,
}: {
  product: Product | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(product?.product_name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (product) {
        await apiFetch(`/api/products/${product.id}/`, {
          method: "PATCH",
          body: JSON.stringify({ product_name: name, description }),
        });
        toast.success("Product updated.");
      } else {
        await apiFetch("/api/products/", {
          method: "POST",
          body: JSON.stringify({ product_name: name, description }),
        });
        toast.success("Product added.");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Product Name" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </Field>
      <Field label="Description">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {error && <p className="text-[13px] font-medium text-primary-600">{error}</p>}
      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Save Product
        </Button>
      </div>
    </form>
  );
}
