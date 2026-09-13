"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Download, Eye, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { usePaginatedList, useList, useDebouncedValue } from "@/lib/hooks";
import { Company, Country } from "@/lib/types";
import { formatDate, mediaUrl } from "@/lib/format";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { ExportColumn } from "@/lib/export-utils";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, RowActionButton } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/SlideOver";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";
import { CompanyForm } from "./CompanyForm";
import { FilterBar } from "@/components/ui/FilterBar";
import { ColumnHeaderFilter } from "@/components/ui/ColumnHeaderFilter";
import { DynamicFilterColumn, useDynamicColumnFilters } from "@/lib/useDynamicColumnFilters";
import { useTableGrid } from "@/lib/useTableGrid";
import { ResizableTh } from "@/components/ui/ResizableTh";

const COMPANIES_EXPORT_COLUMNS: ExportColumn<Company>[] = [
  { header: "Company Name", accessor: (c) => c.company_name, category: "Basic Info", defaultSelected: true },
  { header: "Contact Person", accessor: (c) => c.contact_name, category: "Basic Info", defaultSelected: true },
  { header: "GSTIN", accessor: (c) => c.gstin || c.vat_id || "", category: "Registration & Tax", defaultSelected: true },
  { header: "MSIN Number", accessor: (c) => c.msin_number || "", category: "Registration & Tax", defaultSelected: false },
  { header: "Registration No", accessor: (c) => c.reg_no || "", category: "Registration & Tax", defaultSelected: false },
  { header: "Contact Email", accessor: (c) => c.contact_email, category: "Contact Info", defaultSelected: true },
  { header: "Contact Phone", accessor: (c) => c.contact_phone, category: "Contact Info", defaultSelected: true },
  { header: "Company Phone", accessor: (c) => c.company_phone, category: "Contact Info", defaultSelected: false },
  { header: "Country", accessor: (c) => c.country_name || "", category: "Address & Location", defaultSelected: true },
  { header: "State", accessor: (c) => c.state, category: "Address & Location", defaultSelected: true },
  { header: "City", accessor: (c) => c.city, category: "Address & Location", defaultSelected: true },
  { header: "Zip Code", accessor: (c) => c.zip_code, category: "Address & Location", defaultSelected: false },
  { header: "Address", accessor: (c) => c.address, category: "Address & Location", defaultSelected: false },
  {
    header: "Logo",
    accessor: (c) => (c.logo ? "Uploaded" : "-"),
    imageAccessor: (c) => (c.logo ? mediaUrl(c.logo) : null),
    category: "Media & Web",
    defaultSelected: true,
  },
  { header: "Facebook", accessor: (c) => c.facebook, category: "Media & Web", defaultSelected: false },
  { header: "Twitter / X", accessor: (c) => c.twitter, category: "Media & Web", defaultSelected: false },
  { header: "LinkedIn", accessor: (c) => c.linkedin, category: "Media & Web", defaultSelected: false },
  { header: "Remarks / Notes", accessor: (c) => c.remarks, category: "Remarks & Custom", defaultSelected: false },
  { header: "Created Date", accessor: (c) => formatDate(c.created_at), category: "System Dates", defaultSelected: false },
];

const COMPANIES_PAGE_COLUMNS: ColumnDef[] = [
  { key: "select", label: "Checkbox", required: true },
  { key: "logo", label: "Logo" },
  { key: "company_name", label: "Company Name", required: true },
  { key: "contact_name", label: "Contact Person" },
  { key: "gstin", label: "GSTIN" },
  { key: "msin_number", label: "MSIN Number" },
  { key: "reg_no", label: "Reg No" },
  { key: "country_name", label: "Country" },
  { key: "state", label: "State" },
  { key: "city", label: "City" },
  { key: "zip_code", label: "Zip Code" },
  { key: "address", label: "Address" },
  { key: "contact_email", label: "Contact Email" },
  { key: "contact_phone", label: "Contact Phone" },
  { key: "company_phone", label: "Company Phone" },
  { key: "social", label: "Social Media" },
  { key: "remarks", label: "Remarks" },
  { key: "created_at", label: "Created Date" },
  { key: "actions", label: "Actions", required: true },
];

export default function CompaniesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const { items: countries } = useList<Country>("/api/countries/");

  const baseFilterColumns: DynamicFilterColumn[] = useMemo(
    () => [
      {
        key: "company_name",
        label: "Company Name",
        type: "text",
      },
      {
        key: "gstin",
        label: "GSTIN",
        type: "text",
      },
      {
        key: "msin_number",
        label: "MSIN Number",
        type: "text",
      },
      {
        key: "country",
        label: "Country",
        type: "select",
        options: countries.map((c) => ({ value: c.code, label: c.name })),
      },
      {
        key: "city",
        label: "City",
        type: "text",
      },
      {
        key: "contact_email",
        label: "Contact Email",
        type: "text",
      },
      {
        key: "contact_phone",
        label: "Contact Phone",
        type: "text",
      },
      {
        key: "company_phone",
        label: "Company Phone",
        type: "text",
      },
    ],
    [countries]
  );

  const {
    columns: filterColumns,
    customFields,
    activeFilters,
    setFilter,
    resetFilters,
    appendQueryParams,
  } = useDynamicColumnFilters({
    module: "company",
    baseColumns: baseFilterColumns,
  });

  const allColumns: ColumnDef[] = useMemo(() => {
    const base = [...COMPANIES_PAGE_COLUMNS];
    const actionCol = base.pop()!;
    const dynamicCols: ColumnDef[] = (customFields || []).map((f) => ({
      key: `extra_${f.field_key}`,
      label: f.label,
    }));
    return [...base, ...dynamicCols, actionCol];
  }, [customFields]);

  const grid = useTableGrid({
    tableKey: "companies",
    defaultColumns: allColumns,
    defaultVisibleKeys: COMPANIES_PAGE_COLUMNS.map((c) => c.key),
  });

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    appendQueryParams(params);
    params.set("page", String(page));
    return `/api/companies/?${params.toString()}`;
  }, [debouncedSearch, appendQueryParams, page]);

  const { data, loading, reload } = usePaginatedList<Company>(path);

  const [editing, setEditing] = useState<Company | "new" | null>(null);
  const [deleting, setDeleting] = useState<Company | null>(null);

  const canAdd = can("companies", "add");
  const canEdit = can("companies", "edit");
  const canDelete = can("companies", "delete");

  const getColFilter = (key: string) => filterColumns.find((c) => c.key === key);

  const toggleSelectAll = () => {
    if (!data?.results) return;
    if (selected.size === data.results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.results.map((c) => c.id)));
    }
  };

  const toggleSelectOne = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      await Promise.all(
        Array.from(selected).map((id) => apiFetch(`/api/companies/${id}/`, { method: "DELETE" }))
      );
      toast.success(`Deleted ${selected.size} companies.`);
      setSelected(new Set());
      setBulkDeleteConfirmOpen(false);
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't delete some companies.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const renderCell = (colKey: string, c: Company) => {
    if (colKey === "select") {
      return (
        <td key={colKey} className="w-10 px-3 py-2.5 text-center">
          <input
            type="checkbox"
            checked={selected.has(c.id)}
            onChange={() => toggleSelectOne(c.id)}
            className="h-3.5 w-3.5 rounded border-border-strong text-primary-500 focus:ring-primary-500/20"
          />
        </td>
      );
    }
    if (colKey === "logo") {
      return (
        <td key={colKey} className={TD}>
          {mediaUrl(c.logo) ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, dynamic remote URL
            <img src={mediaUrl(c.logo)!} alt="" width={28} height={28} className="h-7 w-7 rounded-md border border-border object-cover" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-sunken text-ink-faint">
              <Building2 className="h-3.5 w-3.5" />
            </div>
          )}
        </td>
      );
    }
    if (colKey === "company_name") {
      return (
        <td key={colKey} className={`${TD} font-semibold`}>
          <Link href={`/companies/${c.id}`} className="text-ink hover:text-primary-600 transition-colors">
            {c.company_name}
          </Link>
        </td>
      );
    }
    if (colKey === "contact_name") return <td key={colKey} className={`${TD} text-ink`}>{c.contact_name || "—"}</td>;
    if (colKey === "gstin") return <td key={colKey} className={`${TD} font-mono text-xs text-ink-muted`}>{c.gstin || c.vat_id || "—"}</td>;
    if (colKey === "msin_number") return <td key={colKey} className={`${TD} font-mono text-xs text-ink-muted`}>{c.msin_number || "—"}</td>;
    if (colKey === "reg_no") return <td key={colKey} className={`${TD} font-mono text-xs text-ink-muted`}>{c.reg_no || "—"}</td>;
    if (colKey === "country_name") return <td key={colKey} className={`${TD} text-ink-muted`}>{c.country_name || "—"}</td>;
    if (colKey === "state") return <td key={colKey} className={`${TD} text-ink-muted`}>{c.state || "—"}</td>;
    if (colKey === "city") return <td key={colKey} className={`${TD} text-ink-muted`}>{c.city || "—"}</td>;
    if (colKey === "zip_code") return <td key={colKey} className={`${TD} text-ink-muted`}>{c.zip_code || "—"}</td>;
    if (colKey === "address") return <td key={colKey} className={`${TD} text-ink-muted max-w-[200px] truncate`} title={c.address}>{c.address || "—"}</td>;
    if (colKey === "contact_email") return <td key={colKey} className={`${TD} text-ink-muted`}>{c.contact_email || "—"}</td>;
    if (colKey === "contact_phone") return <td key={colKey} className={`${TD} text-ink-muted`}>{c.contact_phone || "—"}</td>;
    if (colKey === "company_phone") return <td key={colKey} className={`${TD} text-ink-muted`}>{c.company_phone || "—"}</td>;
    if (colKey === "social") {
      return (
        <td key={colKey} className={TD}>
          {c.facebook || c.twitter || c.linkedin ? (
            <div className="flex items-center gap-1.5 text-xs text-primary-600">
              {c.facebook && <a href={c.facebook} target="_blank" rel="noopener noreferrer" className="hover:underline">FB</a>}
              {c.twitter && <a href={c.twitter} target="_blank" rel="noopener noreferrer" className="hover:underline">X</a>}
              {c.linkedin && <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="hover:underline">LN</a>}
            </div>
          ) : (
            <span className="text-ink-muted">—</span>
          )}
        </td>
      );
    }
    if (colKey === "remarks") return <td key={colKey} className={`${TD} text-ink-muted max-w-[180px] truncate`} title={c.remarks}>{c.remarks || "—"}</td>;
    if (colKey === "created_at") return <td key={colKey} className={`${TD} text-ink-muted`}>{formatDate(c.created_at)}</td>;
    if (colKey.startsWith("extra_")) {
      const fieldKey = colKey.replace("extra_", "");
      return (
        <td key={colKey} className={`${TD} text-ink-muted`}>
          {String(c.extra_data?.[fieldKey] ?? "—")}
        </td>
      );
    }
    if (colKey === "actions") {
      return (
        <td key={colKey} className={`${TD} text-right`}>
          <div className="flex justify-end gap-1">
            <Link href={`/companies/${c.id}`}>
              <RowActionButton label="View" onClick={() => {}}>
                <Eye className="h-3.5 w-3.5" />
              </RowActionButton>
            </Link>
            {canEdit && (
              <RowActionButton label="Edit" onClick={() => setEditing(c)}>
                <Pencil className="h-3.5 w-3.5" />
              </RowActionButton>
            )}
            {canDelete && (
              <RowActionButton label="Delete" tone="danger" onClick={() => setDeleting(c)}>
                <Trash2 className="h-3.5 w-3.5" />
              </RowActionButton>
            )}
          </div>
        </td>
      );
    }
    return <td key={colKey} className={TD}>—</td>;
  };

  return (
    <div className="flex flex-col gap-4">
      {selected.size > 0 ? (
        <div className="flex items-center justify-between rounded-md border border-primary-100 bg-primary-50 px-4 py-2.5">
          <span className="text-[13.5px] font-semibold text-primary-700">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <ExportDropdown
              data={data?.results || []}
              selectedIds={selected}
              filename="companies_export"
              title="Companies Directory"
              columns={COMPANIES_EXPORT_COLUMNS}
              buttonText="Export Selected"
              variant="outline"
            />
            <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            {canDelete && (
              <Button size="sm" variant="primary" onClick={() => setBulkDeleteConfirmOpen(true)} loading={bulkDeleting}>
                Delete Selected
              </Button>
            )}
          </div>
        </div>
      ) : (
        <FilterBar
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          searchPlaceholder="Search companies by name, email, phone..."
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
                filename="companies_export"
                title="Companies Directory"
                columns={COMPANIES_EXPORT_COLUMNS}
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
                  <Plus className="h-4 w-4" /> Add Company
                </Button>
              )}
            </div>
          }
        />
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {grid.columns
                  .filter((c) => grid.visibleColumns.has(c.key))
                  .map((col) => {
                    if (col.key === "select") {
                      return (
                        <ResizableTh key="select" columnKey="select" grid={grid} isDraggable={false} isResizable={false} align="center" className="w-10 px-3 text-center">
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
                        <ResizableTh key="actions" columnKey="actions" grid={grid} align="right" isDraggable={false}>
                          <span className="sr-only">Actions</span>
                        </ResizableTh>
                      );
                    }
                    if (col.key === "logo") {
                      return (
                        <ResizableTh key="logo" columnKey="logo" grid={grid}>
                          <span>Logo</span>
                        </ResizableTh>
                      );
                    }
                    const filterKey = col.key.startsWith("extra_")
                      ? `custom__${col.key.replace("extra_", "")}`
                      : col.key === "country_name"
                      ? "country"
                      : col.key;
                    const colFilter = getColFilter(filterKey);

                    return (
                      <ResizableTh key={col.key} columnKey={col.key} grid={grid}>
                        <div className="inline-flex items-center">
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
                emptyLabel="No companies yet."
              />
              {data?.results.map((c) => (
                <tr key={c.id} className={TR}>
                  {grid.columns
                    .filter((col) => grid.visibleColumns.has(col.key))
                    .map((col) => renderCell(col.key, c))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && <Pagination count={data.count} page={page} onPageChange={setPage} />}
      </Card>

      <SlideOver open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add Company" : "Edit Company"}>
        {editing !== null && (
          <CompanyForm
            key={editing === "new" ? "new" : editing.id}
            company={editing === "new" ? null : editing}
            countries={countries}
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
          title="Delete company"
          description={`Delete "${deleting.company_name}"? This can be undone later from the archive.`}
          onConfirm={async () => {
            try {
              await apiFetch(`/api/companies/${deleting.id}/`, { method: "DELETE" });
              toast.success("Company deleted.");
              setDeleting(null);
              reload();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Couldn't delete this company.");
            }
          }}
        />
      )}

      {bulkDeleteConfirmOpen && (
        <ConfirmDialog
          open
          onClose={() => setBulkDeleteConfirmOpen(false)}
          title="Delete Selected Companies"
          description={`Are you sure you want to delete ${selected.size} selected companies? This action can be undone later from the archive.`}
          confirmLabel="Delete All Selected"
          onConfirm={handleBulkDelete}
        />
      )}
    </div>
  );
}

export { CompanyForm } from "./CompanyForm";
