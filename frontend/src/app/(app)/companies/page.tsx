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

const COMPANIES_EXPORT_COLUMNS: ExportColumn<Company>[] = [
  { header: "Company Name", accessor: (c) => c.company_name, category: "Basic Info" },
  { header: "Contact Person", accessor: (c) => c.contact_name, category: "Basic Info" },
  { header: "GSTIN", accessor: (c) => c.gstin || c.vat_id || "", category: "Registration & Tax" },
  { header: "MSIN Number", accessor: (c) => c.msin_number || "", category: "Registration & Tax" },
  { header: "Registration No", accessor: (c) => c.reg_no || "", category: "Registration & Tax" },
  { header: "Contact Email", accessor: (c) => c.contact_email, category: "Contact Info" },
  { header: "Contact Phone", accessor: (c) => c.contact_phone, category: "Contact Info" },
  { header: "Company Phone", accessor: (c) => c.company_phone, category: "Contact Info" },
  { header: "Country", accessor: (c) => c.country_name || "", category: "Address & Location" },
  { header: "State", accessor: (c) => c.state, category: "Address & Location" },
  { header: "City", accessor: (c) => c.city, category: "Address & Location" },
  { header: "Zip Code", accessor: (c) => c.zip_code, category: "Address & Location" },
  { header: "Address", accessor: (c) => c.address, category: "Address & Location" },
  { header: "Logo Image URL", accessor: (c) => (c.logo ? mediaUrl(c.logo) : ""), category: "Media & Web" },
  { header: "Facebook", accessor: (c) => c.facebook, category: "Media & Web" },
  { header: "Twitter / X", accessor: (c) => c.twitter, category: "Media & Web" },
  { header: "LinkedIn", accessor: (c) => c.linkedin, category: "Media & Web" },
  { header: "Remarks / Notes", accessor: (c) => c.remarks, category: "Remarks & Custom" },
  { header: "Created Date", accessor: (c) => formatDate(c.created_at), category: "System Dates" },
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
  const [cols, setCols] = useState<Set<string>>(new Set(COMPANIES_PAGE_COLUMNS.map((c) => c.key)));
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
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

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selected.size} companies?`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all(
        Array.from(selected).map((id) => apiFetch(`/api/companies/${id}/`, { method: "DELETE" }))
      );
      toast.success(`Deleted ${selected.size} companies.`);
      setSelected(new Set());
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't delete some companies.");
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Companies"
        action={
          canAdd && (
            <Button variant="primary" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> Add Company
            </Button>
          )
        }
      />

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
              <Button size="sm" variant="primary" onClick={bulkDelete} loading={bulkDeleting}>
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
              <ColumnSelector columns={allColumns} visibleColumns={cols} onChange={setCols} />
            </div>
          }
        />
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
                {cols.has("logo") && <th className={TH}></th>}
                {cols.has("company_name") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Company Name</span>
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
                {cols.has("contact_name") && <th className={TH}>Contact Person</th>}
                {cols.has("gstin") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>GSTIN</span>
                      {getColFilter("gstin") && (
                        <ColumnHeaderFilter
                          column={getColFilter("gstin")!}
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
                {cols.has("msin_number") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>MSIN Number</span>
                      {getColFilter("msin_number") && (
                        <ColumnHeaderFilter
                          column={getColFilter("msin_number")!}
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
                {cols.has("reg_no") && <th className={TH}>Reg No</th>}
                {cols.has("country_name") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Country</span>
                      {getColFilter("country") && (
                        <ColumnHeaderFilter
                          column={getColFilter("country")!}
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
                {cols.has("state") && <th className={TH}>State</th>}
                {cols.has("city") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>City</span>
                      {getColFilter("city") && (
                        <ColumnHeaderFilter
                          column={getColFilter("city")!}
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
                {cols.has("zip_code") && <th className={TH}>Zip Code</th>}
                {cols.has("address") && <th className={TH}>Address</th>}
                {cols.has("contact_email") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Contact Email</span>
                      {getColFilter("contact_email") && (
                        <ColumnHeaderFilter
                          column={getColFilter("contact_email")!}
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
                {cols.has("contact_phone") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Contact Phone</span>
                      {getColFilter("contact_phone") && (
                        <ColumnHeaderFilter
                          column={getColFilter("contact_phone")!}
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
                {cols.has("company_phone") && <th className={TH}>Company Phone</th>}
                {cols.has("social") && <th className={TH}>Social Media</th>}
                {cols.has("remarks") && <th className={TH}>Remarks</th>}
                {cols.has("created_at") && <th className={TH}>Created Date</th>}
                {customFields?.map((f) => {
                  const colKey = `extra_${f.field_key}`;
                  const filterKey = `custom__${f.field_key}`;
                  if (!cols.has(colKey)) return null;
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
                {cols.has("actions") && <th className={TH}></th>}
              </tr>
            </thead>
            <tbody>
              <TableState loading={loading} empty={!loading && (data?.results.length ?? 0) === 0} colSpan={cols.size} emptyLabel="No companies yet." />
              {data?.results.map((c) => (
                <tr key={c.id} className={TR}>
                  {cols.has("select") && (
                    <td className="w-10 px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelectOne(c.id)}
                        className="h-3.5 w-3.5 rounded border-border-strong text-primary-500 focus:ring-primary-500/20"
                      />
                    </td>
                  )}
                  {cols.has("logo") && (
                    <td className={TD}>
                      {mediaUrl(c.logo) ? (
                        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, dynamic remote URL
                        <img src={mediaUrl(c.logo)!} alt="" width={28} height={28} className="h-7 w-7 rounded-md border border-border object-cover" />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-sunken text-ink-faint">
                          <Building2 className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </td>
                  )}
                  {cols.has("company_name") && (
                    <td className={`${TD} font-semibold`}>
                      <Link href={`/companies/${c.id}`} className="text-ink hover:text-primary-600 transition-colors">
                        {c.company_name}
                      </Link>
                    </td>
                  )}
                  {cols.has("contact_name") && <td className={`${TD} text-ink`}>{c.contact_name || "—"}</td>}
                  {cols.has("gstin") && <td className={`${TD} font-mono text-xs text-ink-muted`}>{c.gstin || c.vat_id || "—"}</td>}
                  {cols.has("msin_number") && <td className={`${TD} font-mono text-xs text-ink-muted`}>{c.msin_number || "—"}</td>}
                  {cols.has("reg_no") && <td className={`${TD} font-mono text-xs text-ink-muted`}>{c.reg_no || "—"}</td>}
                  {cols.has("country_name") && <td className={`${TD} text-ink-muted`}>{c.country_name || "—"}</td>}
                  {cols.has("state") && <td className={`${TD} text-ink-muted`}>{c.state || "—"}</td>}
                  {cols.has("city") && <td className={`${TD} text-ink-muted`}>{c.city || "—"}</td>}
                  {cols.has("zip_code") && <td className={`${TD} text-ink-muted`}>{c.zip_code || "—"}</td>}
                  {cols.has("address") && <td className={`${TD} text-ink-muted max-w-[200px] truncate`} title={c.address}>{c.address || "—"}</td>}
                  {cols.has("contact_email") && <td className={`${TD} text-ink-muted`}>{c.contact_email || "—"}</td>}
                  {cols.has("contact_phone") && <td className={`${TD} text-ink-muted`}>{c.contact_phone || "—"}</td>}
                  {cols.has("company_phone") && <td className={`${TD} text-ink-muted`}>{c.company_phone || "—"}</td>}
                  {cols.has("social") && (
                    <td className={TD}>
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
                  )}
                  {cols.has("remarks") && <td className={`${TD} text-ink-muted max-w-[180px] truncate`} title={c.remarks}>{c.remarks || "—"}</td>}
                  {cols.has("created_at") && <td className={`${TD} text-ink-muted`}>{formatDate(c.created_at)}</td>}
                  {customFields?.map((f) =>
                    cols.has(`extra_${f.field_key}`) ? (
                      <td key={f.id} className={`${TD} text-ink-muted`}>
                        {String(c.extra_data?.[f.field_key] ?? "—")}
                      </td>
                    ) : null
                  )}
                  {cols.has("actions") && (
                    <td className={`${TD} text-right`}>
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
                  )}
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
    </div>
  );
}

export { CompanyForm } from "./CompanyForm";
