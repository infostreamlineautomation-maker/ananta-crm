"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError, Paginated } from "@/lib/api";
import { usePaginatedList, useList, useDebouncedValue } from "@/lib/hooks";
import { CustomFieldDefinition, Product } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, RowActionButton } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { DynamicFormFields } from "@/components/custom-fields/DynamicFormFields";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { FilterBar } from "@/components/ui/FilterBar";
import { ColumnHeaderFilter } from "@/components/ui/ColumnHeaderFilter";
import { ProductModal } from "@/components/products/ProductModal";
import { DynamicFilterColumn, useDynamicColumnFilters } from "@/lib/useDynamicColumnFilters";

export default function ProductsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const baseFilterColumns: DynamicFilterColumn[] = useMemo(
    () => [
      {
        key: "product_name",
        label: "Product Name",
        type: "text",
      },
      {
        key: "description",
        label: "Description",
        type: "text",
      },
    ],
    []
  );

  const {
    columns: filterColumns,
    customFields,
    activeFilters,
    setFilter,
    resetFilters,
    appendQueryParams,
  } = useDynamicColumnFilters({
    module: "product",
    baseColumns: baseFilterColumns,
  });

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    appendQueryParams(params);
    params.set("page", String(page));
    return `/api/products/?${params.toString()}`;
  }, [debouncedSearch, appendQueryParams, page]);

  const { data, loading, reload } = usePaginatedList<Product>(path);

  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const canAdd = can("catalog", "add");
  const canEdit = can("catalog", "edit");
  const canDelete = can("catalog", "delete");

  const colSpan = 3 + (customFields?.length || 0);
  const getColFilter = (key: string) => filterColumns.find((c) => c.key === key);

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

      <FilterBar
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Search products..."
        filters={filterColumns}
        activeFilters={activeFilters}
        onFilterChange={(k, v) => {
          setFilter(k, v);
          setPage(1);
        }}
        onReset={() => {
          resetFilters();
          setSearch("");
          setPage(1);
        }}
        actions={
          <ExportDropdown
            data={data?.results || []}
            filename="products_export"
            title="Product Catalog"
            columns={[
              { header: "Product Name", accessor: (p) => p.product_name },
              { header: "Description", accessor: (p) => p.description || "" },
              ...(customFields || []).map((f) => ({
                header: f.label,
                accessor: (p: Product) => String(p.extra_data?.[f.field_key] ?? ""),
              })),
            ]}
          />
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className={TH}>
                  <div className="inline-flex items-center">
                    <span>Product Name</span>
                    {getColFilter("product_name") && (
                      <ColumnHeaderFilter
                        column={getColFilter("product_name")!}
                        activeFilters={activeFilters}
                        onFilterChange={(k, v) => {
                          setFilter(k, v);
                          setPage(1);
                        }}
                      />
                    )}
                  </div>
                </th>
                <th className={TH}>
                  <div className="inline-flex items-center">
                    <span>Description</span>
                    {getColFilter("description") && (
                      <ColumnHeaderFilter
                        column={getColFilter("description")!}
                        activeFilters={activeFilters}
                        onFilterChange={(k, v) => {
                          setFilter(k, v);
                          setPage(1);
                        }}
                      />
                    )}
                  </div>
                </th>
                {customFields?.map((f) => {
                  const filterKey = `custom__${f.field_key}`;
                  const colFilter = getColFilter(filterKey);
                  return (
                    <th key={f.id} className={TH}>
                      <div className="inline-flex items-center">
                        <span>{f.label}</span>
                        {colFilter && (
                          <ColumnHeaderFilter
                            column={colFilter}
                            activeFilters={activeFilters}
                            onFilterChange={(k, v) => {
                              setFilter(k, v);
                              setPage(1);
                            }}
                          />
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className={TH}></th>
              </tr>
            </thead>
            <tbody>
              <TableState loading={loading} empty={!loading && (data?.results.length ?? 0) === 0} colSpan={colSpan} emptyLabel="No products yet." />
              {data?.results.map((p) => (
                <tr key={p.id} className={TR}>
                  <td className={`${TD} font-semibold`}>{p.product_name}</td>
                  <td className={`${TD} max-w-md truncate text-ink-muted`}>{p.description || "—"}</td>
                  {customFields?.map((f) => (
                    <td key={f.id} className={`${TD} text-ink-muted`}>
                      {String(p.extra_data?.[f.field_key] ?? "—")}
                    </td>
                  ))}
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

      <ProductModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        product={editing === "new" ? null : editing}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />

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
