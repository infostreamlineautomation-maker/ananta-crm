"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Download, Eye, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { usePaginatedList, useList, useDebouncedValue } from "@/lib/hooks";
import { Company, Country } from "@/lib/types";
import { mediaUrl } from "@/lib/format";
import { exportToCsv, CsvColumn } from "@/lib/csv-export";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, RowActionButton } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/SlideOver";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, FieldGroup, Input, Textarea } from "@/components/ui/Field";
import { Combobox } from "@/components/ui/Combobox";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";

import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";

const COMPANIES_PAGE_COLUMNS: ColumnDef[] = [
  { key: "logo", label: "Logo" },
  { key: "company_name", label: "Company Name", required: true },
  { key: "country_name", label: "Country" },
  { key: "city", label: "City" },
  { key: "contact_email", label: "Contact Email" },
  { key: "contact_phone", label: "Phone" },
  { key: "actions", label: "Actions", required: true },
];

import { FilterBar, FilterGroupConfig } from "@/components/ui/FilterBar";

export default function CompaniesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [cols, setCols] = useState<Set<string>>(new Set(COMPANIES_PAGE_COLUMNS.map((c) => c.key)));
  const debouncedSearch = useDebouncedValue(search);
  const { items: countries } = useList<Country>("/api/countries/");

  const companyFilterConfigs: FilterGroupConfig[] = useMemo(() => [
    {
      key: "country",
      label: "Country",
      options: countries.map((c) => ({ value: c.code, label: c.name })),
    },
  ], [countries]);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (countryFilter) params.set("country", countryFilter);
    params.set("page", String(page));
    return `/api/companies/?${params.toString()}`;
  }, [debouncedSearch, countryFilter, page]);

  const { data, loading, reload } = usePaginatedList<Company>(path);

  const [editing, setEditing] = useState<Company | "new" | null>(null);
  const [deleting, setDeleting] = useState<Company | null>(null);

  const canAdd = can("companies", "add");
  const canEdit = can("companies", "edit");
  const canDelete = can("companies", "delete");

  const activeFilters = {
    country: countryFilter,
  };

  function handleFilterChange(key: string, val: string) {
    if (key === "country") setCountryFilter(val);
    setPage(1);
  }

  function handleResetFilters() {
    setCountryFilter("");
    setSearch("");
    setPage(1);
  }

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
        filters={companyFilterConfigs}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                const list = data?.results || [];
                if (!list.length) return;
                const cols: CsvColumn<Company>[] = [
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
                ];
                exportToCsv(list, cols, "companies_export");
              }}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <ColumnSelector columns={COMPANIES_PAGE_COLUMNS} visibleColumns={cols} onChange={setCols} />
          </div>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {cols.has("logo") && <th className={TH}></th>}
                {cols.has("company_name") && <th className={TH}>Company Name</th>}
                {cols.has("country_name") && <th className={TH}>Country</th>}
                {cols.has("city") && <th className={TH}>City</th>}
                {cols.has("contact_email") && <th className={TH}>Contact Email</th>}
                {cols.has("contact_phone") && <th className={TH}>Phone</th>}
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

export function CompanyForm({
  company,
  countries,
  onCancel,
  onSaved,
}: {
  company: Company | null;
  countries: Country[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    company_name: company?.company_name ?? "",
    contact_name: company?.contact_name ?? "",
    vat_id: company?.vat_id ?? "",
    reg_no: company?.reg_no ?? "",
    contact_email: company?.contact_email ?? "",
    contact_phone: company?.contact_phone ?? "",
    company_phone: company?.company_phone ?? "",
    country: company?.country ?? ("" as string | number),
    state: company?.state ?? "",
    city: company?.city ?? "",
    zip_code: company?.zip_code ?? "",
    address: company?.address ?? "",
    facebook: company?.facebook ?? "",
    twitter: company?.twitter ?? "",
    linkedin: company?.linkedin ?? "",
    remarks: company?.remarks ?? "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const countryOptions = countries.map((c) => ({ value: c.code, label: c.name, sublabel: c.currency_code }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, String(v ?? "")));
      if (logoFile) body.append("logo", logoFile);

      if (company) {
        await apiFetch(`/api/companies/${company.id}/`, { method: "PATCH", body });
        toast.success("Company updated.");
      } else {
        await apiFetch("/api/companies/", { method: "POST", body });
        toast.success("Company added.");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this company.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FieldGroup title="Basic Info">
        <Field label="Company Name" required className="sm:col-span-2">
          <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} required autoFocus />
        </Field>
        <Field label="Contact Name">
          <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Registration">
        <Field label="VAT ID">
          <Input value={form.vat_id} onChange={(e) => set("vat_id", e.target.value)} />
        </Field>
        <Field label="Registration No.">
          <Input value={form.reg_no} onChange={(e) => set("reg_no", e.target.value)} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Contact">
        <Field label="Contact Email">
          <Input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
        </Field>
        <Field label="Contact Phone">
          <Input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
        </Field>
        <Field label="Company Phone">
          <Input value={form.company_phone} onChange={(e) => set("company_phone", e.target.value)} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Address">
        <Field label="Country">
          <Combobox
            value={form.country || null}
            onChange={(v) => set("country", v)}
            options={countryOptions}
            placeholder="Select country..."
          />
        </Field>
        <Field label="State">
          <Input value={form.state} onChange={(e) => set("state", e.target.value)} />
        </Field>
        <Field label="City">
          <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Zip Code">
          <Input value={form.zip_code} onChange={(e) => set("zip_code", e.target.value)} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Social Links">
        <Field label="Facebook">
          <Input value={form.facebook} onChange={(e) => set("facebook", e.target.value)} placeholder="https://facebook.com/..." />
        </Field>
        <Field label="Twitter">
          <Input value={form.twitter} onChange={(e) => set("twitter", e.target.value)} placeholder="https://x.com/..." />
        </Field>
        <Field label="LinkedIn" className="sm:col-span-2">
          <Input value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="https://linkedin.com/company/..." />
        </Field>
      </FieldGroup>

      <FieldGroup title="Branding">
        <Field label="Logo" className="sm:col-span-2">
          <div className="flex items-center gap-3">
            {mediaUrl(company?.logo) && !logoFile ? (
              // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, dynamic remote URL
              <img src={mediaUrl(company?.logo)!} alt="" width={44} height={44} className="h-11 w-11 rounded-md border border-border object-cover" />
            ) : logoFile ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob: preview URL, next/image can't render these
              <img src={URL.createObjectURL(logoFile)} alt="" width={44} height={44} className="h-11 w-11 rounded-md border border-border object-cover" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-md border border-dashed border-border-strong text-ink-faint">
                <Building2 className="h-4.5 w-4.5" />
              </div>
            )}
            <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-white px-3 text-[13px] font-semibold text-ink hover:bg-surface-hover">
              <Upload className="h-3.5 w-3.5" />
              Upload logo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </Field>
      </FieldGroup>

      <Field label="Remarks">
        <Textarea value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
      </Field>

      {error && <p className="text-[13px] font-medium text-primary-600">{error}</p>}

      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Save Company
        </Button>
      </div>
    </form>
  );
}
