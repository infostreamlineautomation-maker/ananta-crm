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
import { ExportColumn } from "@/lib/export-utils";
import { formatDate } from "@/lib/format";
import { FilterBar } from "@/components/ui/FilterBar";
import { ColumnHeaderFilter } from "@/components/ui/ColumnHeaderFilter";
import { ProductModal } from "@/components/products/ProductModal";
import { DynamicFilterColumn, useDynamicColumnFilters } from "@/lib/useDynamicColumnFilters";
import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";

const BASE_PRODUCTS_COLUMNS: ColumnDef[] = [
  { key: "select", label: "Select", required: true, defaultVisible: true },
  { key: "product_name", label: "Product Name", required: true, defaultVisible: true },
  { key: "description", label: "Description", defaultVisible: true },
  { key: "created_at", label: "Created Date", defaultVisible: false },
  { key: "updated_at", label: "Updated Date", defaultVisible: false },
  { key: "actions", label: "Actions", required: true, defaultVisible: true },
];

export default function ProductsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
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

  const pageColumns: ColumnDef[] = useMemo(() => {
    const list: ColumnDef[] = [
      { key: "select", label: "Select", required: true, defaultVisible: true },
      { key: "product_name", label: "Product Name", required: true, defaultVisible: true },
      { key: "description", label: "Description", defaultVisible: true },
    ];
    if (customFields && customFields.length > 0) {
      customFields.forEach((cf) => {
        list.push({
          key: `custom_${cf.field_key}`,
          label: cf.label,
          defaultVisible: true,
        });
      });
    }
    list.push(
      { key: "created_at", label: "Created Date", defaultVisible: false },
      { key: "updated_at", label: "Updated Date", defaultVisible: false },
      { key: "actions", label: "Actions", required: true, defaultVisible: true }
    );
    return list;
  }, [customFields]);

  const [cols, setCols] = useState<Set<string>>(
    new Set(["select", "product_name", "description", "created_at", "updated_at", "actions"])
  );

  useEffect(() => {
    if (customFields && customFields.length > 0) {
      setCols((prev) => {
        const next = new Set(prev);
        customFields.forEach((cf) => next.add(`custom_${cf.field_key}`));
        return next;
      });
    }
  }, [customFields]);

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

  const toggleSelectAll = () => {
    if (!data?.results) return;
    if (selected.size === data.results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.results.map((p) => p.id)));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selected.size} selected product(s)?`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all(
        Array.from(selected).map((id) => apiFetch(`/api/products/${id}/`, { method: "DELETE" }))
      );
      toast.success(`${selected.size} product(s) deleted successfully`);
      setSelected(new Set());
      reload();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete selected products");
    } finally {
      setBulkDeleting(false);
    }
  };

  const productExportColumns: ExportColumn<Product>[] = useMemo(() => {
    const base: ExportColumn<Product>[] = [
      { key: "product_name", header: "Product Name", accessor: (p) => p.product_name, category: "Basic Information", defaultSelected: true },
      { key: "description", header: "Description", accessor: (p) => p.description || "", category: "Basic Information", defaultSelected: true },
    ];

    if (customFields && customFields.length > 0) {
      customFields.forEach((cf: CustomFieldDefinition) => {
        base.push({
          key: `custom_${cf.field_key}`,
          header: cf.label,
          accessor: (p) => {
            const val = p.extra_data?.[cf.field_key];
            if (val === undefined || val === null) return "";
            if (typeof val === "boolean") return val ? "Yes" : "No";
            return String(val);
          },
          category: "Custom Fields",
        });
      });
    }

    base.push(
      { key: "created_at", header: "Created Date", accessor: (p) => formatDate(p.created_at), category: "System Dates" },
      { key: "updated_at", header: "Last Updated", accessor: (p) => formatDate(p.updated_at), category: "System Dates" }
    );

    return base;
  }, [customFields]);

  const colSpan = 4 + (customFields?.length || 0);
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
          <div className="flex items-center gap-2">
            <ColumnSelector
              columns={pageColumns}
              visibleColumns={cols}
              onChange={setCols}
            />
            <ExportDropdown
              data={data?.results || []}
              selectedIds={selected}
              filename="products_export"
              title="Product Catalog"
              columns={productExportColumns}
            />
          </div>
        }
      />

      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-900 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2 font-medium">
            <span>{selected.size} product(s) selected</span>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-primary-600 hover:text-primary-800 underline ml-2"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2">
            <ExportDropdown
              data={data?.results || []}
              selectedIds={selected}
              filename="products_export"
              title="Product Catalog"
              columns={productExportColumns}
            />
            {canDelete && (
              <Button
                variant="danger"
                size="sm"
                onClick={bulkDelete}
                loading={bulkDeleting}
                className="h-8"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete Selected ({selected.size})
              </Button>
            )}
          </div>
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {cols.has("select") && (
                  <th className="w-10 px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(data?.results?.length && selected.size === data.results.length)}
                      onChange={toggleSelectAll}
                      className="h-3.5 w-3.5 rounded border-border-strong text-primary-500 focus:ring-primary-500/20"
                    />
                  </th>
                )}
                {cols.has("product_name") && (
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
                )}
                {cols.has("description") && (
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
                )}
                {customFields?.map((f) => {
                  if (!cols.has(`custom_${f.field_key}`)) return null;
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
                {cols.has("created_at") && <th className={TH}>Created Date</th>}
                {cols.has("updated_at") && <th className={TH}>Updated Date</th>}
                {cols.has("actions") && <th className={TH}></th>}
              </tr>
            </thead>
            <tbody>
              <TableState loading={loading} empty={!loading && (data?.results.length ?? 0) === 0} colSpan={Array.from(cols).length} emptyLabel="No products yet." />
              {data?.results.map((p) => (
                <tr key={p.id} className={TR}>
                  {cols.has("select") && (
                    <td className="w-10 px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelectOne(p.id)}
                        className="h-3.5 w-3.5 rounded border-border-strong text-primary-500 focus:ring-primary-500/20"
                      />
                    </td>
                  )}
                  {cols.has("product_name") && <td className={`${TD} font-semibold`}>{p.product_name}</td>}
                  {cols.has("description") && <td className={`${TD} max-w-md truncate text-ink-muted`}>{p.description || "—"}</td>}
                  {customFields?.map((f) => {
                    if (!cols.has(`custom_${f.field_key}`)) return null;
                    return (
                      <td key={f.id} className={`${TD} text-ink-muted`}>
                        {String(p.extra_data?.[f.field_key] ?? "—")}
                      </td>
                    );
                  })}
                  {cols.has("created_at") && <td className={`${TD} text-ink-muted text-xs`}>{formatDate(p.created_at)}</td>}
                  {cols.has("updated_at") && <td className={`${TD} text-ink-muted text-xs`}>{formatDate(p.updated_at)}</td>}
                  {cols.has("actions") && (
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
                  )}
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
