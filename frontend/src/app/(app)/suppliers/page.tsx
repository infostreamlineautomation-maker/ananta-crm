"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Copy,
  Check,
  FileSpreadsheet,
  FileText,
  Package,
  Pencil,
  Plus,
  Trash2,
  X,
  Download,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError, Paginated } from "@/lib/api";
import { usePaginatedList, useDebouncedValue } from "@/lib/hooks";
import { Company, Country, CustomFieldDefinition, Product, Supplier } from "@/lib/types";
import { CompanyForm } from "@/app/(app)/companies/CompanyForm";
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
import { ResizableTh } from "@/components/ui/ResizableTh";
import { useTableGrid } from "@/lib/useTableGrid";
import { FilterBar } from "@/components/ui/FilterBar";
import { ColumnHeaderFilter } from "@/components/ui/ColumnHeaderFilter";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { ExportColumn } from "@/lib/export-utils";
import { formatDate, mediaUrl } from "@/lib/format";
import { ProductModal } from "@/components/products/ProductModal";
import { DynamicFilterColumn, useDynamicColumnFilters } from "@/lib/useDynamicColumnFilters";
import { AttachmentDropdown, AttachmentItem } from "@/components/ui/AttachmentDropdown";
import { ItemsDropdown } from "@/components/ui/ItemsDropdown";
import clsx from "clsx";

export const SUPPLIER_RATING_TONE: Record<string, { badge: string; label: string; description: string }> = {
  A: {
    badge: "bg-emerald-100 text-emerald-800 border-emerald-300 ring-emerald-500/20",
    label: "Grade A",
    description: "Top / Best Supplier",
  },
  B: {
    badge: "bg-sky-100 text-sky-800 border-sky-300 ring-sky-500/20",
    label: "Grade B",
    description: "Standard Supplier",
  },
  C: {
    badge: "bg-amber-100 text-amber-800 border-amber-300 ring-amber-500/20",
    label: "Grade C",
    description: "Low Priority Supplier",
  },
};

const TH_CELL = "px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-ink-faint whitespace-nowrap";
const TD_CELL = "px-3 py-2.5 text-[12.5px] text-ink align-middle";

const SUPPLIERS_PAGE_COLUMNS: ColumnDef[] = [
  { key: "select", label: "Select", required: true },
  { key: "sr", label: "SR", required: true },
  { key: "rating", label: "Rating (ABC)" },
  { key: "supplier_name", label: "Supplier Name", required: true },
  { key: "source", label: "Source / Origin", defaultVisible: false },
  { key: "products", label: "Products" },
  { key: "company_name", label: "Company Name" },
  { key: "contact", label: "Primary Business Contact" },
  { key: "email", label: "Business Email" },
  { key: "website", label: "Website", defaultVisible: false },
  { key: "address", label: "Office Address", defaultVisible: false },
  { key: "remark", label: "Internal Notes", defaultVisible: false },
  { key: "docs", label: "Docs", defaultVisible: false },
  { key: "created_at", label: "Created Date", defaultVisible: false },
  { key: "updated_at", label: "Updated Date", defaultVisible: false },
  { key: "actions", label: "Action", required: true },
];

export default function SuppliersPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [copiedContact, setCopiedContact] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const baseFilterColumns: DynamicFilterColumn[] = useMemo(
    () => [
      {
        key: "rating",
        label: "ABC Rating",
        type: "select",
        options: [
          { value: "A", label: "Grade A (Top / Best)", dotColor: "#10b981" },
          { value: "B", label: "Grade B (Standard)", dotColor: "#0284c7" },
          { value: "C", label: "Grade C (Low Priority)", dotColor: "#f59e0b" },
        ],
      },
      {
        key: "supplier_name",
        label: "Supplier Name",
        type: "text",
      },
      {
        key: "products",
        label: "Products",
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
      defaultVisible: false,
    }));
    return [...base, ...dynamicCols, actionCol];
  }, [customFields]);

  const grid = useTableGrid({
    tableKey: "suppliers",
    defaultColumns: allColumns,
    defaultVisibleKeys: [
      "select",
      "sr",
      "rating",
      "supplier_name",
      "products",
      "company_name",
      "contact",
      "email",
      "actions",
    ],
  });

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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const canAdd = can("suppliers", "add");
  const canEdit = can("suppliers", "edit");
  const canDelete = can("suppliers", "delete");

  const toggleSelectAll = () => {
    if (!data?.results) return;
    if (selected.size === data.results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.results.map((s) => s.id)));
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
    setBulkDeleting(true);
    try {
      await Promise.all(
        Array.from(selected).map((id) => apiFetch(`/api/suppliers/${id}/`, { method: "DELETE" }))
      );
      toast.success(`${selected.size} supplier(s) deleted successfully`);
      setSelected(new Set());
      reload();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete selected suppliers");
    } finally {
      setBulkDeleting(false);
      setConfirmBulkDelete(false);
    }
  };

  const supplierExportColumns: ExportColumn<Supplier>[] = useMemo(() => {
    const base: ExportColumn<Supplier>[] = [
      { key: "supplier_name", header: "Supplier Name", accessor: (s) => s.supplier_name, category: "Basic Information", defaultSelected: true },
      { key: "rating", header: "Rating (ABC)", accessor: (s) => s.rating ? `Grade ${s.rating}` : "Grade B", category: "Basic Information", defaultSelected: true },
      { key: "company_name", header: "Company Name", accessor: (s) => s.company_name || s.owner_name_contact || "", category: "Basic Information", defaultSelected: true },
      { key: "source", header: "Source / Origin", accessor: (s) => s.source || "", category: "Basic Information", defaultSelected: true },
      { key: "contact", header: "Primary Contact Number", accessor: (s) => s.contact || "", category: "Contact Details", defaultSelected: true },
      { key: "additional_contacts", header: "Additional Contacts", accessor: (s) => s.contacts?.map((c) => `${c.contact_name} (${c.contact_number}${c.designation ? ` - ${c.designation}` : ""})`).join("; ") || "", category: "Contact Details" },
      { key: "email", header: "Email Address", accessor: (s) => s.email || "", category: "Contact Details", defaultSelected: true },
      { key: "website", header: "Website", accessor: (s) => s.website || "", category: "Contact Details" },
      { key: "address", header: "Office Address", accessor: (s) => s.address || "", category: "Contact Details", defaultSelected: true },
      { key: "products", header: "Products List", accessor: (s) => s.supplier_products?.map((p) => p.product_name).join(", ") || "", category: "Products & Materials", defaultSelected: true },
      { key: "product_details", header: "Product Details / Notes", accessor: (s) => s.product_details || "", category: "Products & Materials" },
      { key: "quotation_files", header: "Quotation Files (URLs)", accessor: (s) => s.files?.filter((f) => f.file_type === "quotation").map((f) => mediaUrl(f.file)).join(", ") || "", category: "Files & Documents" },
      { key: "rate_card_files", header: "Rate Card Files (URLs)", accessor: (s) => s.files?.filter((f) => f.file_type === "rate_card").map((f) => mediaUrl(f.file)).join(", ") || "", category: "Files & Documents" },
      { key: "other_docs", header: "Brochures & Other Documents", accessor: (s) => s.files?.filter((f) => f.file_type !== "quotation" && f.file_type !== "rate_card").map((f) => mediaUrl(f.file)).join(", ") || "", category: "Files & Documents" },
      { key: "all_files", header: "All Attached Files (URLs)", accessor: (s) => s.files?.map((f) => `${f.file_type.toUpperCase()}: ${mediaUrl(f.file)}`).join("\n") || "", category: "Files & Documents" },
      { key: "remark", header: "Internal Notes / Remarks", accessor: (s) => s.remark || "", category: "Internal Notes", defaultSelected: true },
      { key: "created_at", header: "Created Date", accessor: (s) => formatDate(s.created_at), category: "System Dates" },
      { key: "updated_at", header: "Last Updated", accessor: (s) => formatDate(s.updated_at), category: "System Dates" },
    ];

    if (customFields && customFields.length > 0) {
      customFields.forEach((cf: CustomFieldDefinition) => {
        base.push({
          key: `custom_${cf.field_key}`,
          header: cf.label,
          accessor: (s) => {
            const val = s.extra_data?.[cf.field_key];
            if (val === undefined || val === null) return "";
            if (typeof val === "boolean") return val ? "Yes" : "No";
            return String(val);
          },
          category: "Custom Fields",
        });
      });
    }

    return base;
  }, [customFields]);

  const getColFilter = (key: string) => filterColumns.find((c) => c.key === key);

  function copyToClipboard(text: string, e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedContact(text);
    toast.success("Contact copied to clipboard");
    setTimeout(() => setCopiedContact(null), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
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
              selectedIds={selected}
              filename="suppliers_export"
              title="Suppliers Directory"
              columns={supplierExportColumns}
            />
            <ColumnSelector
              columns={grid.columns}
              visibleColumns={grid.visibleColumns}
              onChange={grid.setVisibleColumns}
              onReorder={grid.reorderColumns}
              onReset={grid.resetGrid}
            />
            {canAdd && (
              <Button variant="primary" onClick={() => setEditing("new")}>
                <Plus className="h-4 w-4" /> Add Supplier
              </Button>
            )}
          </div>
        }
      />

      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-900 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2 font-medium">
            <span>{selected.size} supplier(s) selected</span>
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
              filename="suppliers_export"
              title="Suppliers Directory"
              columns={supplierExportColumns}
            />
            {canDelete && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmBulkDelete(true)}
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

      <Card className="overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[1100px] text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left">
                {grid.columns
                  .filter((col) => grid.visibleColumns.has(col.key))
                  .map((col) => {
                    if (col.key === "select") {
                      return (
                        <ResizableTh
                          key="select"
                          columnKey="select"
                          grid={grid}
                          isDraggable={false}
                          isResizable={false}
                          className="w-10 px-3 py-2.5 text-center"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(data?.results?.length && selected.size === data.results.length)}
                            onChange={toggleSelectAll}
                            className="h-3.5 w-3.5 rounded border-border-strong text-primary-500 focus:ring-primary-500/20"
                          />
                        </ResizableTh>
                      );
                    }

                    if (col.key === "actions") {
                      return (
                        <ResizableTh
                          key="actions"
                          columnKey="actions"
                          grid={grid}
                          align="right"
                          isDraggable={false}
                          className={`${TH_CELL} w-16 min-w-[60px] text-right px-2`}
                        >
                          <span>Action</span>
                        </ResizableTh>
                      );
                    }

                    if (col.key === "sr") {
                      return (
                        <ResizableTh
                          key="sr"
                          columnKey="sr"
                          grid={grid}
                          align="center"
                          className={`${TH_CELL} w-10 min-w-[40px] text-center px-1`}
                        >
                          <span>SR</span>
                        </ResizableTh>
                      );
                    }

                    if (col.key === "rating") {
                      const colFilter = getColFilter("rating");
                      return (
                        <ResizableTh
                          key="rating"
                          columnKey="rating"
                          grid={grid}
                          align="center"
                          className={`${TH_CELL} w-16 min-w-[65px] text-center px-1`}
                        >
                          <div className="inline-flex items-center justify-center gap-1">
                            <span>Rating</span>
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
                        </ResizableTh>
                      );
                    }

                    const filterKey = col.key.startsWith("extra_")
                      ? `custom__${col.key.replace("extra_", "")}`
                      : col.key;
                    const colFilter = getColFilter(filterKey);

                    return (
                      <ResizableTh
                        key={col.key}
                        columnKey={col.key}
                        grid={grid}
                        className={TH_CELL}
                      >
                        <div className="inline-flex items-center gap-1">
                          <span>{col.label}</span>
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
                      </ResizableTh>
                    );
                  })}
              </tr>
            </thead>
            <tbody>
              <TableState
                loading={loading}
                empty={!loading && (data?.results.length ?? 0) === 0}
                colSpan={grid.visibleColumns.size}
                emptyLabel="No suppliers yet."
              />
              {data?.results.map((s, idx) => {
                const srNo = (page - 1) * 20 + idx + 1;
                const totalDocs = s.files?.length || 0;
                const productsCount = s.supplier_products?.length || 0;

                const attachmentItems: AttachmentItem[] = (s.files || []).map((f) => {
                  const filePath = f.file || "";
                  const fileName = filePath.split("/").pop() || "Document";
                  return {
                    id: f.id,
                    file: f.file,
                    file_url: f.file,
                    file_name: fileName,
                    file_size: f.file_size,
                    category: f.file_type === "rate_card" ? "rate_list" : "catalogue",
                  };
                });

                return (
                  <tr key={s.id} className={TR}>
                    {grid.columns
                      .filter((col) => grid.visibleColumns.has(col.key))
                      .map((col) => {
                        if (col.key.startsWith("extra_")) {
                          const fieldKey = col.key.replace("extra_", "");
                          return (
                            <td key={col.key} className={`${TD_CELL} text-ink-muted truncate`}>
                              {String(s.extra_data?.[fieldKey] ?? "—")}
                            </td>
                          );
                        }

                        switch (col.key) {
                          case "select":
                            return (
                              <td key="select" className="w-10 px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={selected.has(s.id)}
                                  onChange={() => toggleSelectOne(s.id)}
                                  className="h-3.5 w-3.5 rounded border-border-strong text-primary-500 focus:ring-primary-500/20"
                                />
                              </td>
                            );
                          case "sr":
                            return <td key="sr" className={`${TD_CELL} text-center font-medium text-ink-muted px-1`}>{srNo}</td>;
                          case "rating":
                            return (
                              <td key="rating" className={`${TD_CELL} text-center px-1`}>
                                <span
                                  className={clsx(
                                    "inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-black shadow-xs",
                                    (s.rating || "B") === "A"
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                      : (s.rating || "B") === "B"
                                      ? "bg-sky-100 text-sky-800 border border-sky-300"
                                      : "bg-amber-100 text-amber-800 border border-amber-300"
                                  )}
                                  title={`${SUPPLIER_RATING_TONE[s.rating || "B"]?.label || `Grade ${s.rating}`} — ${SUPPLIER_RATING_TONE[s.rating || "B"]?.description || ""}`}
                                >
                                  {s.rating || "B"}
                                </span>
                              </td>
                            );
                          case "supplier_name":
                            return (
                              <td key="supplier_name" className={TD_CELL}>
                                <Link
                                  href={`/suppliers/${s.id}`}
                                  className="font-bold text-primary-600 hover:text-primary-700 hover:underline uppercase text-[12px] tracking-wide whitespace-nowrap block"
                                  title={s.supplier_name}
                                >
                                  {s.supplier_name}
                                </Link>
                              </td>
                            );
                          case "source":
                            return (
                              <td key="source" className={TD_CELL}>
                                {s.source ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-surface-sunken text-ink border border-border whitespace-nowrap">
                                    {s.source}
                                  </span>
                                ) : (
                                  <span className="text-ink-faint">—</span>
                                )}
                              </td>
                            );
                          case "products":
                            return (
                              <td key="products" className={TD_CELL}>
                                {(() => {
                                  const productItems: string[] = s.product_details
                                    ? s.product_details.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean)
                                    : (s.supplier_products || []).map((sp) => sp.product_name).filter(Boolean);

                                  return <ItemsDropdown items={productItems} title="Products" maxDisplayWidth="max-w-[120px]" />;
                                })()}
                              </td>
                            );
                          case "company_name":
                            return (
                              <td key="company_name" className={`${TD_CELL} text-ink font-medium whitespace-nowrap`}>
                                {s.company ? (
                                  <Link href={`/companies/${s.company}`} className="text-primary-600 hover:underline">
                                    {s.company_name || s.owner_name_contact}
                                  </Link>
                                ) : (
                                  s.company_name || s.owner_name_contact || "—"
                                )}
                              </td>
                            );
                          case "contact":
                            return (
                              <td key="contact" className={TD_CELL}>
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
                            );
                          case "email":
                            return (
                              <td key="email" className={`${TD_CELL} whitespace-nowrap`}>
                                {s.email ? (
                                  <a href={`mailto:${s.email}`} className="text-primary-600 hover:underline" title={s.email}>
                                    {s.email}
                                  </a>
                                ) : (
                                  <span className="text-ink-faint">—</span>
                                )}
                              </td>
                            );
                          case "website":
                            return (
                              <td key="website" className={`${TD_CELL} whitespace-nowrap`}>
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
                            );
                          case "address":
                            return (
                              <td key="address" className={`${TD_CELL} text-ink-muted max-w-[200px] truncate`} title={s.address || ""}>
                                {s.address || "—"}
                              </td>
                            );
                          case "remark":
                            return (
                              <td key="remark" className={`${TD_CELL} text-ink-muted max-w-[160px] truncate`} title={s.remark || ""}>
                                {s.remark || "N/A"}
                              </td>
                            );
                          case "docs":
                            return (
                              <td key="docs" className={`${TD_CELL} px-2`}>
                                <AttachmentDropdown files={attachmentItems} maxDisplayWidth="max-w-[120px]" />
                              </td>
                            );
                          case "created_at":
                            return <td key="created_at" className={`${TD_CELL} text-ink-muted text-xs whitespace-nowrap`}>{formatDate(s.created_at)}</td>;
                          case "updated_at":
                            return <td key="updated_at" className={`${TD_CELL} text-ink-muted text-xs whitespace-nowrap`}>{formatDate(s.updated_at)}</td>;
                          case "actions":
                            return (
                              <td key="actions" className={`${TD_CELL} text-right px-2`}>
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
                            );
                          default:
                            return null;
                        }
                      })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data && <Pagination count={data.count} page={page} onPageChange={setPage} />}
      </Card>

      {confirmBulkDelete && (
        <ConfirmDialog
          open={confirmBulkDelete}
          onClose={() => setConfirmBulkDelete(false)}
          onConfirm={bulkDelete}
          title="Delete Suppliers"
          description={`Are you sure you want to delete ${selected.size} selected supplier(s)? This action cannot be undone.`}
          confirmLabel="Delete Suppliers"
          loading={bulkDeleting}
        />
      )}

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
  onSaved: (savedSupplier?: Supplier) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    supplier_name: supplier?.supplier_name ?? "",
    rating: (supplier?.rating as "A" | "B" | "C") ?? "B",
    company: supplier?.company ?? ("" as string | number),
    company_name: supplier?.company_name ?? supplier?.owner_name_contact ?? "",
    contact: supplier?.contact ?? "",
    source: supplier?.source ?? "",
    email: supplier?.email ?? "",
    website: supplier?.website ?? "",
    address: supplier?.address ?? "",
    remark: supplier?.remark ?? "",
  });

  const [companies, setCompanies] = useState<Company[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [quickAddCompanyOpen, setQuickAddCompanyOpen] = useState(false);

  const initialProducts = useMemo(() => {
    if (supplier?.product_details) {
      const list = supplier.product_details.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      if (list.length > 0) return list;
    }
    if (supplier?.supplier_products && supplier.supplier_products.length > 0) {
      const list = supplier.supplier_products.map((sp) => sp.product_name).filter(Boolean);
      if (list.length > 0) return list;
    }
    return [""];
  }, [supplier]);

  const [products, setProducts] = useState<string[]>(initialProducts);

  const [extraData, setExtraData] = useState<Record<string, any>>(supplier?.extra_data || {});
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [deletedFileIds, setDeletedFileIds] = useState<Set<number>>(new Set());
  const [catalogueFiles, setCatalogueFiles] = useState<File[]>([]);
  const [rateListFiles, setRateListFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCompanies = useCallback(() => {
    apiFetch<Paginated<Company>>("/api/companies/?page_size=200")
      .then((res) => setCompanies(res.results || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadCompanies();
    apiFetch<Country[]>("/api/countries/")
      .then((res) => {
        if (Array.isArray(res)) setCountries(res);
        else if ((res as any)?.results) setCountries((res as any).results);
      })
      .catch(() => {});
  }, [loadCompanies]);

  useEffect(() => {
    apiFetch<Paginated<any>>("/api/custom-fields/?module=supplier")
      .then((res) => setCustomFields(res.results || []))
      .catch(() => {});
  }, []);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleDeleteExistingFile(fileId: number) {
    try {
      await apiFetch(`/api/supplier-files/${fileId}/`, { method: "DELETE" });
      setDeletedFileIds((prev) => new Set(prev).add(fileId));
      toast.success("File removed.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't delete this file.");
    }
  }

  function handleAddCatalogueFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setCatalogueFiles((prev) => [...prev, ...newFiles]);
      e.target.value = "";
    }
  }

  function handleAddRateListFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setRateListFiles((prev) => [...prev, ...newFiles]);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const allProductNames = products.map((s) => s.trim()).filter(Boolean);
      const productDetailsStr = allProductNames.join(", ");

      const payload = {
        ...form,
        company: form.company ? Number(form.company) : null,
        owner_name_contact: form.company_name, // keep backward compat
        product_details: productDetailsStr,
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

      // Upload newly added catalogue files in bulk
      if (catalogueFiles.length > 0) {
        try {
          const qBody = new FormData();
          qBody.append("supplier", String(savedSupplier.id));
          qBody.append("file_type", "quotation");
          catalogueFiles.forEach((f) => qBody.append("files", f));
          await apiFetch("/api/supplier-files/bulk_upload/", { method: "POST", body: qBody });
        } catch {
          toast.error("Supplier saved, but some catalogue files failed to upload.");
        }
      }

      // Upload newly added rate list files in bulk
      if (rateListFiles.length > 0) {
        try {
          const rBody = new FormData();
          rBody.append("supplier", String(savedSupplier.id));
          rBody.append("file_type", "rate_card");
          rateListFiles.forEach((f) => rBody.append("files", f));
          await apiFetch("/api/supplier-files/bulk_upload/", { method: "POST", body: rBody });
        } catch {
          toast.error("Supplier saved, but some rate list files failed to upload.");
        }
      }

      onSaved(savedSupplier);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this supplier.");
    } finally {
      setSaving(false);
    }
  }

  const existingCatalogues = (supplier?.files || []).filter(
    (f) => !deletedFileIds.has(f.id) && (f.file_type === "quotation" || f.file_type === "brochure")
  );
  const existingRateLists = (supplier?.files || []).filter(
    (f) => !deletedFileIds.has(f.id) && f.file_type === "rate_card"
  );

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Supplier Name" required>
          <Input value={form.supplier_name} onChange={(e) => set("supplier_name", e.target.value)} required autoFocus />
        </Field>

        <Field label="Supplier Rating (ABC Classification)" hint="Grade this supplier to easily recognize top-tier vendors">
          <div className="grid grid-cols-3 gap-2">
            {(["A", "B", "C"] as const).map((r) => {
              const isSelected = form.rating === r;
              const config = SUPPLIER_RATING_TONE[r];
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => set("rating", r)}
                  className={clsx(
                    "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                    isSelected
                      ? r === "A"
                        ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 font-bold shadow-xs"
                        : r === "B"
                        ? "bg-sky-50 border-sky-500 ring-2 ring-sky-500/20 text-sky-950 font-bold shadow-xs"
                        : "bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 font-bold shadow-xs"
                      : "bg-white border-border text-ink-muted hover:bg-surface-hover hover:text-ink"
                  )}
                >
                  <span
                    className={clsx(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black mb-1",
                      r === "A" ? "bg-emerald-600 text-white" : r === "B" ? "bg-sky-600 text-white" : "bg-amber-600 text-white"
                    )}
                  >
                    {r}
                  </span>
                  <span className="text-[12px] font-bold">{config.label}</span>
                  <span className="text-[10px] text-ink-muted mt-0.5">{config.description}</span>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Company Name">
          <Combobox
            value={form.company || null}
            onChange={(v) => {
              set("company", v || "");
              const matched = companies.find((c) => c.id === v);
              if (matched) {
                set("company_name", matched.company_name);
              } else if (!v) {
                set("company_name", "");
              }
            }}
            options={companies.map((c) => ({ value: c.id, label: c.company_name }))}
            placeholder="Select or enter company..."
            onAddNew={() => setQuickAddCompanyOpen(true)}
            addNewLabel="Add new company"
          />
        </Field>
        <Field label="Contact Number">
          <Input value={form.contact} onChange={(e) => set("contact", e.target.value)} placeholder="e.g. +91 9876543210" />
        </Field>
        <Field label="Source">
          <Input value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="e.g. IndiaMART, referral" />
        </Field>

        {/* Product Names Data Entry */}
        <div className="rounded-xl border border-border bg-surface-sunken/30 p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[13px] font-bold text-ink flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-primary-500" /> Products
              </span>
              <p className="text-[11px] text-ink-muted">Enter product names, materials or items supplied by this vendor</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {products.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    value={p}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProducts((prev) => prev.map((item, i) => (i === idx ? val : item)));
                    }}
                    placeholder={
                      idx === 0
                        ? "e.g. Offset Printing / Paper 300 GSM"
                        : idx === 1
                        ? "e.g. Vinyl Banners / Lamination Sheets"
                        : `Product / Item ${idx + 1}`
                    }
                  />
                </div>
                {products.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setProducts((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 text-ink-muted hover:text-rose-600 rounded transition cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setProducts((prev) => [...prev, ""])}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add Another Product
            </button>
          </div>
        </div>

        {/* Catalogue Files (Multiple Upload) */}
        <div className="rounded-xl border border-border bg-surface-sunken/40 p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[13px] font-bold text-ink flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-primary-500" /> Catalogue
              </span>
              <p className="text-[11px] text-ink-muted">Upload supplier product catalogues, brochures, or sample sheets</p>
            </div>
            <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-ink shadow-xs hover:bg-surface-hover transition">
              <Plus className="h-3 w-3" /> Add Files
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx"
                className="hidden"
                onChange={handleAddCatalogueFiles}
              />
            </label>
          </div>

          {/* New files selected */}
          {catalogueFiles.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-primary-700">Selected for upload ({catalogueFiles.length}):</span>
              <div className="flex flex-wrap gap-1.5">
                {catalogueFiles.map((file, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-primary-50 text-primary-900 border border-primary-200"
                  >
                    <span className="truncate max-w-[180px]">{file.name}</span>
                    <span className="text-[10px] text-primary-600">({(file.size / 1024).toFixed(0)} KB)</span>
                    <button
                      type="button"
                      onClick={() => setCatalogueFiles((prev) => prev.filter((_, i) => i !== idx))}
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
          {existingCatalogues.length > 0 && (
            <div className="pt-1.5 border-t border-border/70 flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-ink-faint">Previously attached ({existingCatalogues.length}):</span>
              <div className="flex flex-wrap gap-1.5">
                {existingCatalogues.map((f) => (
                  <span
                    key={f.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-white text-ink hover:border-primary-300 border border-border shadow-2xs group"
                  >
                    <a
                      href={f.file}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate max-w-[150px] hover:text-primary-600 hover:underline"
                      title={`View / Download: ${f.file.split("/").pop()}`}
                    >
                      {f.file.split("/").pop()}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteExistingFile(f.id)}
                      className="text-ink-muted hover:text-rose-600 transition p-0.5 rounded cursor-pointer"
                      title="Delete this file"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rate List Files (Multiple Upload) */}
        <div className="rounded-xl border border-border bg-surface-sunken/40 p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[13px] font-bold text-ink flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Rate List
              </span>
              <p className="text-[11px] text-ink-muted">Upload rate sheets, price lists, or cost cards</p>
            </div>
            <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-ink shadow-xs hover:bg-surface-hover transition">
              <Plus className="h-3 w-3" /> Add Files
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx"
                className="hidden"
                onChange={handleAddRateListFiles}
              />
            </label>
          </div>

          {/* New files selected */}
          {rateListFiles.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-emerald-800">Selected for upload ({rateListFiles.length}):</span>
              <div className="flex flex-wrap gap-1.5">
                {rateListFiles.map((file, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-emerald-50 text-emerald-900 border border-emerald-200"
                  >
                    <span className="truncate max-w-[180px]">{file.name}</span>
                    <span className="text-[10px] text-emerald-700">({(file.size / 1024).toFixed(0)} KB)</span>
                    <button
                      type="button"
                      onClick={() => setRateListFiles((prev) => prev.filter((_, i) => i !== idx))}
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
          {existingRateLists.length > 0 && (
            <div className="pt-1.5 border-t border-border/70 flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-ink-faint">Previously attached ({existingRateLists.length}):</span>
              <div className="flex flex-wrap gap-1.5">
                {existingRateLists.map((f) => (
                  <span
                    key={f.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-white text-ink hover:border-emerald-300 border border-border shadow-2xs group"
                  >
                    <a
                      href={f.file}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate max-w-[150px] hover:text-emerald-700 hover:underline"
                      title={`View / Download: ${f.file.split("/").pop()}`}
                    >
                      {f.file.split("/").pop()}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteExistingFile(f.id)}
                      className="text-ink-muted hover:text-rose-600 transition p-0.5 rounded cursor-pointer"
                      title="Delete this file"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
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

      <SlideOver
        open={quickAddCompanyOpen}
        onClose={() => setQuickAddCompanyOpen(false)}
        title="Add New Company"
        size="lg"
        zIndex={60}
      >
        <CompanyForm
          company={null}
          countries={countries}
          onCancel={() => setQuickAddCompanyOpen(false)}
          onSaved={(created) => {
            if (created) {
              setCompanies((prev) => [...prev, created]);
              set("company", created.id);
              set("company_name", created.company_name);
            }
            setQuickAddCompanyOpen(false);
          }}
        />
      </SlideOver>
    </>
  );
}
