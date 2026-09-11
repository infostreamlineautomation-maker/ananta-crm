"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Download, Eye, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { usePaginatedList, useList, useDebouncedValue } from "@/lib/hooks";
import { Company, Country } from "@/lib/types";
import { mediaUrl } from "@/lib/format";
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

const COMPANIES_PAGE_COLUMNS: ColumnDef[] = [
  { key: "logo", label: "Logo" },
  { key: "company_name", label: "Company Name", required: true },
  { key: "country_name", label: "Country" },
  { key: "city", label: "City" },
  { key: "contact_email", label: "Contact Email" },
  { key: "contact_phone", label: "Phone" },
  { key: "actions", label: "Actions", required: true },
];

export default function CompaniesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [cols, setCols] = useState<Set<string>>(new Set(COMPANIES_PAGE_COLUMNS.map((c) => c.key)));
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
              filename="companies_export"
              title="Companies Directory"
              columns={[
                { header: "Company Name", accessor: (c) => c.company_name },
                { header: "Contact Name", accessor: (c) => c.contact_name },
                { header: "VAT / Tax ID", accessor: (c) => c.vat_id },
                { header: "Reg No", accessor: (c) => c.reg_no },
                { header: "Country", accessor: (c) => c.country_name || "" },
                { header: "City", accessor: (c) => c.city },
                { header: "Contact Email", accessor: (c) => c.contact_email },
                { header: "Contact Phone", accessor: (c) => c.contact_phone },
                { header: "Company Phone", accessor: (c) => c.company_phone },
                { header: "Address", accessor: (c) => c.address },
              ]}
            />
            <ColumnSelector columns={allColumns} visibleColumns={cols} onChange={setCols} />
          </div>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
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
                      <span>Phone</span>
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
                  {cols.has("country_name") && <td className={`${TD} text-ink-muted`}>{c.country_name || "—"}</td>}
                  {cols.has("city") && <td className={`${TD} text-ink-muted`}>{c.city || "—"}</td>}
                  {cols.has("contact_email") && <td className={`${TD} text-ink-muted`}>{c.contact_email || "—"}</td>}
                  {cols.has("contact_phone") && <td className={`${TD} text-ink-muted`}>{c.contact_phone || "—"}</td>}
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
