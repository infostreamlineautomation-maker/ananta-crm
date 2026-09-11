"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Check, FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError, Paginated } from "@/lib/api";
import { usePaginatedList, useDebouncedValue } from "@/lib/hooks";
import { CustomFieldDefinition, Product, Supplier } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, RowActionButton } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/SlideOver";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Combobox } from "@/components/ui/Combobox";
import { TR, TableState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { DynamicFormFields } from "@/components/custom-fields/DynamicFormFields";
import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";
import { FilterBar } from "@/components/ui/FilterBar";
import { ColumnHeaderFilter } from "@/components/ui/ColumnHeaderFilter";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { ProductModal } from "@/components/products/ProductModal";
import { DynamicFilterColumn, useDynamicColumnFilters } from "@/lib/useDynamicColumnFilters";

const TH_CELL = "px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-ink-faint whitespace-nowrap";
const TD_CELL = "px-3 py-2.5 text-[12.5px] text-ink align-middle";

const SUPPLIERS_PAGE_COLUMNS: ColumnDef[] = [
  { key: "sr", label: "SR", required: true },
  { key: "supplier_name", label: "Supplier Name", required: true },
  { key: "source", label: "Source / Origin" },
  { key: "products", label: "Products" },
  { key: "company_name", label: "Company Name" },
  { key: "contact", label: "Primary Business Contact" },
  { key: "email", label: "Business Email" },
  { key: "website", label: "Website" },
  { key: "address", label: "Office Address" },
  { key: "remark", label: "Internal Notes" },
  { key: "docs", label: "Docs" },
  { key: "actions", label: "Action", required: true },
];

export default function SuppliersPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [cols, setCols] = useState<Set<string>>(new Set(SUPPLIERS_PAGE_COLUMNS.map((c) => c.key)));
  const [copiedContact, setCopiedContact] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const baseFilterColumns: DynamicFilterColumn[] = useMemo(
    () => [
      {
        key: "supplier_name",
        label: "Supplier Name",
        type: "text",
      },
      {
        key: "source",
        label: "Source / Origin",
        type: "text",
      },
      {
        key: "company_name",
        label: "Company Name",
        type: "text",
      },
      {
        key: "contact",
        label: "Primary Business Contact",
        type: "text",
      },
      {
        key: "email",
        label: "Business Email",
        type: "text",
      },
      {
        key: "website",
        label: "Website",
        type: "text",
      },
      {
        key: "address",
        label: "Office Address",
        type: "text",
      },
      {
        key: "remark",
        label: "Internal Notes",
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
    module: "supplier",
    baseColumns: baseFilterColumns,
  });

  const allColumns: ColumnDef[] = useMemo(() => {
    const base = [...SUPPLIERS_PAGE_COLUMNS];
    const actionCol = base.pop()!;
    const dynamicCols: ColumnDef[] = (customFields || []).map((f: CustomFieldDefinition) => ({
      key: `extra_${f.field_key}`,
      label: f.label,
    }));
    return [...base, ...dynamicCols, actionCol];
  }, [customFields]);

  useEffect(() => {
    if (customFields && customFields.length > 0) {
      setCols((prev) => {
        const next = new Set(prev);
        customFields.forEach((f: CustomFieldDefinition) => {
          if (f.show_in_table) next.add(`extra_${f.field_key}`);
        });
        return next;
      });
    }
  }, [customFields]);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    appendQueryParams(params);
    params.set("page", String(page));
    return `/api/suppliers/?${params.toString()}`;
  }, [debouncedSearch, appendQueryParams, page]);

  const { data, loading, reload } = usePaginatedList<Supplier>(path);

  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);

  const canAdd = can("suppliers", "add");
  const canEdit = can("suppliers", "edit");
  const canDelete = can("suppliers", "delete");

  const getColFilter = (key: string) => filterColumns.find((c) => c.key === key);

  function copyToClipboard(text: string, e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedContact(text);
    toast.success("Contact copied to clipboard");
    setTimeout(() => setCopiedContact(null), 2000);
  }

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
        searchPlaceholder="Search suppliers by name, company, email..."
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
            <ExportDropdown
              data={data?.results || []}
              filename="suppliers_export"
              title="Suppliers Directory"
              columns={[
                { header: "Supplier Name", accessor: (s) => s.supplier_name },
                { header: "Company Name", accessor: (s) => s.company_name || s.owner_name_contact || "" },
                { header: "Source / Origin", accessor: (s) => s.source || "" },
                { header: "Products", accessor: (s) => s.supplier_products?.map((p) => p.product_name).join(", ") || "" },
                { header: "Contact Number", accessor: (s) => s.contact || "" },
                { header: "Email", accessor: (s) => s.email || "" },
                { header: "Website", accessor: (s) => s.website || "" },
                { header: "Office Address", accessor: (s) => s.address || "" },
                { header: "Internal Notes", accessor: (s) => s.remark || "" },
              ]}
            />
            <ColumnSelector columns={allColumns} visibleColumns={cols} onChange={setCols} />
          </div>
        }
      />

      <Card className="overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[1100px] text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left">
                {cols.has("sr") && <th className={`${TH_CELL} w-10 min-w-[40px] text-center px-1`}>SR</th>}
                {cols.has("supplier_name") && (
                  <th className={`${TH_CELL} min-w-[160px]`}>
                    <div className="inline-flex items-center gap-1">
                      <span>Supplier Name</span>
                      {getColFilter("supplier_name") && (
                        <ColumnHeaderFilter
                          column={getColFilter("supplier_name")!}
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
                {cols.has("source") && (
                  <th className={`${TH_CELL} min-w-[85px]`}>
                    <div className="inline-flex items-center gap-1">
                      <span>Source</span>
                      {getColFilter("source") && (
                        <ColumnHeaderFilter
                          column={getColFilter("source")!}
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
                {cols.has("products") && (
                  <th className={`${TH_CELL} min-w-[95px]`}>
                    <span>Products</span>
                  </th>
                )}
                {cols.has("company_name") && (
                  <th className={`${TH_CELL} min-w-[130px]`}>
                    <div className="inline-flex items-center gap-1">
                      <span>Company</span>
                      {getColFilter("company_name") && (
                        <ColumnHeaderFilter
                          column={getColFilter("company_name")!}
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
                {cols.has("contact") && (
                  <th className={`${TH_CELL} min-w-[145px]`}>
                    <div className="inline-flex items-center gap-1">
                      <span>Contact</span>
                      {getColFilter("contact") && (
                        <ColumnHeaderFilter
                          column={getColFilter("contact")!}
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
                {cols.has("email") && (
                  <th className={`${TH_CELL} min-w-[160px]`}>
                    <div className="inline-flex items-center gap-1">
                      <span>Email</span>
                      {getColFilter("email") && (
                        <ColumnHeaderFilter
                          column={getColFilter("email")!}
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
                {cols.has("website") && (
                  <th className={`${TH_CELL} min-w-[110px]`}>
                    <div className="inline-flex items-center gap-1">
                      <span>Website</span>
                      {getColFilter("website") && (
                        <ColumnHeaderFilter
                          column={getColFilter("website")!}
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
                {cols.has("address") && (
                  <th className={`${TH_CELL} min-w-[150px]`}>
                    <div className="inline-flex items-center gap-1">
                      <span>Address</span>
                      {getColFilter("address") && (
                        <ColumnHeaderFilter
                          column={getColFilter("address")!}
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
                {cols.has("remark") && (
                  <th className={`${TH_CELL} min-w-[110px]`}>
                    <div className="inline-flex items-center gap-1">
                      <span>Notes</span>
                      {getColFilter("remark") && (
                        <ColumnHeaderFilter
                          column={getColFilter("remark")!}
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
                {cols.has("docs") && <th className={`${TH_CELL} w-14 min-w-[50px] text-center px-1`}>Docs</th>}
                {customFields?.map((f: CustomFieldDefinition) => {
                  const colKey = `extra_${f.field_key}`;
                  const filterKey = `custom__${f.field_key}`;
                  if (!cols.has(colKey)) return null;
                  const colFilter = getColFilter(filterKey);
                  return (
                    <th key={f.id} className={`${TH_CELL} min-w-[120px]`}>
                      <div className="inline-flex items-center gap-1">
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
                {cols.has("actions") && <th className={`${TH_CELL} w-16 min-w-[60px] text-right px-2`}></th>}
              </tr>
            </thead>
            <tbody>
              <TableState loading={loading} empty={!loading && (data?.results.length ?? 0) === 0} colSpan={cols.size} emptyLabel="No suppliers yet." />
              {data?.results.map((s, idx) => {
                const srNo = (page - 1) * 20 + idx + 1;
                const totalDocs = s.files?.length || 0;
                const productsCount = s.supplier_products?.length || 0;

                return (
                  <tr key={s.id} className={TR}>
                    {cols.has("sr") && <td className={`${TD_CELL} text-center font-medium text-ink-muted px-1`}>{srNo}</td>}
                    {cols.has("supplier_name") && (
                      <td className={TD_CELL}>
                        <Link
                          href={`/suppliers/${s.id}`}
                          className="font-bold text-primary-600 hover:text-primary-700 hover:underline uppercase text-[12px] tracking-wide whitespace-nowrap block"
                          title={s.supplier_name}
                        >
                          {s.supplier_name}
                        </Link>
                      </td>
                    )}
                    {cols.has("source") && (
                      <td className={TD_CELL}>
                        {s.source ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-surface-sunken text-ink border border-border whitespace-nowrap">
                            {s.source}
                          </span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                    )}
                    {cols.has("products") && (
                      <td className={TD_CELL}>
                        {productsCount > 0 ? (
                          <Link
                            href={`/suppliers/${s.id}?tab=products`}
                            className="inline-flex items-center px-2.5 py-1 text-[11.5px] font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded whitespace-nowrap transition"
                          >
                            View ({productsCount})
                          </Link>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                    )}
                    {cols.has("company_name") && (
                      <td className={`${TD_CELL} text-ink font-medium whitespace-nowrap`}>
                        {s.company_name || s.owner_name_contact || "—"}
                      </td>
                    )}
                    {cols.has("contact") && (
                      <td className={TD_CELL}>
                        {s.contact ? (
                          <div className="inline-flex items-center gap-1.5 font-mono text-[12px] text-ink whitespace-nowrap">
                            <span>{s.contact}</span>
                            <button
                              type="button"
                              onClick={(e) => copyToClipboard(s.contact, e)}
                              className="text-ink-muted hover:text-primary-600 transition p-0.5 rounded"
                              title="Copy contact number"
                            >
                              {copiedContact === s.contact ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                    )}
                    {cols.has("email") && (
                      <td className={`${TD_CELL} whitespace-nowrap`}>
                        {s.email ? (
                          <a href={`mailto:${s.email}`} className="text-primary-600 hover:underline" title={s.email}>
                            {s.email}
                          </a>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                    )}
                    {cols.has("website") && (
                      <td className={`${TD_CELL} whitespace-nowrap`}>
                        {s.website ? (
                          <a
                            href={s.website.startsWith("http") ? s.website : `https://${s.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:underline"
                            title={s.website}
                          >
                            {s.website.replace(/^https?:\/\//, "")}
                          </a>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                    )}
                    {cols.has("address") && (
                      <td className={`${TD_CELL} text-ink-muted max-w-[200px] truncate`} title={s.address || ""}>
                        {s.address || "—"}
                      </td>
                    )}
                    {cols.has("remark") && (
                      <td className={`${TD_CELL} text-ink-muted max-w-[160px] truncate`} title={s.remark || ""}>
                        {s.remark || "N/A"}
                      </td>
                    )}
                    {cols.has("docs") && (
                      <td className={`${TD_CELL} text-center px-1`}>
                        <Link
                          href={`/suppliers/${s.id}?tab=files`}
                          className="inline-flex items-center justify-center gap-1 text-[12px] font-medium text-ink-muted hover:text-primary-600 transition"
                          title={`${totalDocs} document(s)`}
                        >
                          <FileText className="h-3.5 w-3.5 text-primary-500" />
                          <span>{totalDocs}</span>
                        </Link>
                      </td>
                    )}
                    {customFields?.map((f: CustomFieldDefinition) =>
                      cols.has(`extra_${f.field_key}`) ? (
                        <td key={f.id} className={`${TD_CELL} text-ink-muted truncate`}>
                          {String(s.extra_data?.[f.field_key] ?? "—")}
                        </td>
                      ) : null
                    )}
                    {cols.has("actions") && (
                      <td className={`${TD_CELL} text-right px-2`}>
                        <div className="flex justify-end items-center gap-1">
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
                );
              })}
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
  const { can } = useAuth();
  const [form, setForm] = useState({
    supplier_name: supplier?.supplier_name ?? "",
    company_name: supplier?.company_name ?? supplier?.owner_name_contact ?? "",
    contact: supplier?.contact ?? "",
    source: supplier?.source ?? "",
    email: supplier?.email ?? "",
    website: supplier?.website ?? "",
    address: supplier?.address ?? "",
    remark: supplier?.remark ?? "",
  });
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>(
    supplier?.supplier_products?.map((sp) => sp.product) || []
  );
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [pickingProduct, setPickingProduct] = useState<number | "">("");
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [extraData, setExtraData] = useState<Record<string, any>>(supplier?.extra_data || {});
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [quotationFiles, setQuotationFiles] = useState<File[]>([]);
  const [rateCardFiles, setRateCardFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAddProduct = can("catalog", "add");

  function loadProducts() {
    apiFetch<Paginated<Product>>("/api/products/?page_size=200")
      .then((res) => setAllProducts(res.results || []))
      .catch(() => {});
  }

  useEffect(() => {
    loadProducts();
    apiFetch<Paginated<any>>("/api/custom-fields/?module=supplier")
      .then((res) => setCustomFields(res.results || []))
      .catch(() => {});
  }, []);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSelectProduct(productId: number | string) {
    const id = Number(productId);
    if (id && !selectedProductIds.includes(id)) {
      setSelectedProductIds((prev) => [...prev, id]);
    }
    setPickingProduct("");
  }

  function handleRemoveProduct(productId: number) {
    setSelectedProductIds((prev) => prev.filter((id) => id !== productId));
  }

  function handleProductCreated(newProduct: Product) {
    setAllProducts((prev) => [...prev, newProduct]);
    setSelectedProductIds((prev) => [...prev, newProduct.id]);
    toast.success(`"${newProduct.product_name}" added and linked to supplier.`);
  }

  function handleAddQuotationFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setQuotationFiles((prev) => [...prev, ...newFiles]);
      e.target.value = "";
    }
  }

  function handleAddRateCardFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setRateCardFiles((prev) => [...prev, ...newFiles]);
      e.target.value = "";
    }
  }

  const unselectedProducts = allProducts.filter((p) => !selectedProductIds.includes(p.id));
  const productOptions = unselectedProducts.map((p) => ({ value: p.id, label: p.product_name }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        owner_name_contact: form.company_name, // keep backward compat
        product_ids: selectedProductIds,
        extra_data: extraData,
      };

      let savedSupplier: Supplier;
      if (supplier) {
        savedSupplier = await apiFetch<Supplier>(`/api/suppliers/${supplier.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Supplier updated.");
      } else {
        savedSupplier = await apiFetch<Supplier>("/api/suppliers/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Supplier added.");
      }

      // Upload newly added quotation files in bulk
      if (quotationFiles.length > 0) {
        try {
          const qBody = new FormData();
          qBody.append("supplier", String(savedSupplier.id));
          qBody.append("file_type", "quotation");
          quotationFiles.forEach((f) => qBody.append("files", f));
          await apiFetch("/api/supplier-files/bulk_upload/", { method: "POST", body: qBody });
        } catch {
          toast.error("Supplier saved, but some quotation files failed to upload.");
        }
      }

      // Upload newly added rate card files in bulk
      if (rateCardFiles.length > 0) {
        try {
          const rBody = new FormData();
          rBody.append("supplier", String(savedSupplier.id));
          rBody.append("file_type", "rate_card");
          rateCardFiles.forEach((f) => rBody.append("files", f));
          await apiFetch("/api/supplier-files/bulk_upload/", { method: "POST", body: rBody });
        } catch {
          toast.error("Supplier saved, but some rate card files failed to upload.");
        }
      }

      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this supplier.");
    } finally {
      setSaving(false);
    }
  }

  const existingQuotations = supplier?.files?.filter(
    (f) => f.file_type === "quotation" || f.file_type === "brochure"
  ) || [];
  const existingRateCards = supplier?.files?.filter((f) => f.file_type === "rate_card") || [];

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Supplier Name" required>
          <Input value={form.supplier_name} onChange={(e) => set("supplier_name", e.target.value)} required autoFocus />
        </Field>
        <Field label="Company Name">
          <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="e.g. Acme Corp" />
        </Field>
        <Field label="Contact Number">
          <Input value={form.contact} onChange={(e) => set("contact", e.target.value)} placeholder="e.g. +91 9876543210" />
        </Field>
        <Field label="Source">
          <Input value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="e.g. IndiaMART, referral" />
        </Field>

        <Field label="Link Catalog Products" hint="Connect products from your catalog with this supplier">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Combobox
                  value={pickingProduct || null}
                  onChange={handleSelectProduct}
                  options={productOptions}
                  placeholder="Select products to link..."
                />
              </div>
              {canAddProduct && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setCreateProductOpen(true)}
                  className="whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" /> New Product
                </Button>
              )}
            </div>

            {selectedProductIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-surface-sunken rounded-lg border border-border">
                {selectedProductIds.map((id) => {
                  const prod = allProducts.find((p) => p.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-surface text-ink border border-border shadow-xs"
                    >
                      <span>{prod?.product_name || `Product #${id}`}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(id)}
                        className="text-ink-muted hover:text-rose-600 transition p-0.5 rounded cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </Field>

        {/* Quotation Files (Multiple Upload) */}
        <div className="rounded-xl border border-border bg-surface-sunken/40 p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[13px] font-bold text-ink flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary-500" /> Quotations
              </span>
              <p className="text-[11px] text-ink-muted">Upload supplier price quotations or proposals (multiple files allowed)</p>
            </div>
            <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-ink shadow-xs hover:bg-surface-hover transition">
              <Plus className="h-3 w-3" /> Add Files
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx"
                className="hidden"
                onChange={handleAddQuotationFiles}
              />
            </label>
          </div>

          {/* New files selected */}
          {quotationFiles.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-primary-700">Selected for upload ({quotationFiles.length}):</span>
              <div className="flex flex-wrap gap-1.5">
                {quotationFiles.map((file, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-primary-50 text-primary-900 border border-primary-200"
                  >
                    <span className="truncate max-w-[180px]">{file.name}</span>
                    <span className="text-[10px] text-primary-600">({(file.size / 1024).toFixed(0)} KB)</span>
                    <button
                      type="button"
                      onClick={() => setQuotationFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-primary-700 hover:text-rose-600 transition cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Existing uploaded files if editing */}
          {existingQuotations.length > 0 && (
            <div className="pt-1.5 border-t border-border/70 flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-ink-faint">Previously attached ({existingQuotations.length}):</span>
              <div className="flex flex-wrap gap-1.5">
                {existingQuotations.map((f) => (
                  <a
                    key={f.id}
                    href={f.file}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-white text-ink-muted hover:text-primary-600 border border-border"
                  >
                    <span className="truncate max-w-[150px]">{f.file.split("/").pop()}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rate Card Files (Multiple Upload) */}
        <div className="rounded-xl border border-border bg-surface-sunken/40 p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[13px] font-bold text-ink flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-emerald-600" /> Rate Cards
              </span>
              <p className="text-[11px] text-ink-muted">Upload rate sheets, price lists, or cost cards (multiple files allowed)</p>
            </div>
            <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-ink shadow-xs hover:bg-surface-hover transition">
              <Plus className="h-3 w-3" /> Add Files
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx"
                className="hidden"
                onChange={handleAddRateCardFiles}
              />
            </label>
          </div>

          {/* New files selected */}
          {rateCardFiles.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-emerald-800">Selected for upload ({rateCardFiles.length}):</span>
              <div className="flex flex-wrap gap-1.5">
                {rateCardFiles.map((file, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-emerald-50 text-emerald-900 border border-emerald-200"
                  >
                    <span className="truncate max-w-[180px]">{file.name}</span>
                    <span className="text-[10px] text-emerald-700">({(file.size / 1024).toFixed(0)} KB)</span>
                    <button
                      type="button"
                      onClick={() => setRateCardFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-emerald-800 hover:text-rose-600 transition cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Existing uploaded files if editing */}
          {existingRateCards.length > 0 && (
            <div className="pt-1.5 border-t border-border/70 flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-ink-faint">Previously attached ({existingRateCards.length}):</span>
              <div className="flex flex-wrap gap-1.5">
                {existingRateCards.map((f) => (
                  <a
                    key={f.id}
                    href={f.file}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-white text-ink-muted hover:text-emerald-700 border border-border"
                  >
                    <span className="truncate max-w-[150px]">{f.file.split("/").pop()}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="supplier@example.com" />
        </Field>
        <Field label="Website">
          <Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://..." />
        </Field>
        <Field label="Address">
          <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Office / Factory address..." />
        </Field>
        <Field label="Remark">
          <Textarea value={form.remark} onChange={(e) => set("remark", e.target.value)} placeholder="Internal notes or terms..." />
        </Field>

        {customFields.length > 0 && (
          <DynamicFormFields
            fields={customFields}
            values={extraData}
            onChange={(k, v) => setExtraData((prev) => ({ ...prev, [k]: v }))}
          />
        )}

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

      <ProductModal
        open={createProductOpen}
        onClose={() => setCreateProductOpen(false)}
        onSaved={handleProductCreated}
      />
    </>
  );
}
