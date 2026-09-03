"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError, Paginated } from "@/lib/api";
import { usePaginatedList, useList, useDebouncedValue } from "@/lib/hooks";
import { Client, ClientType, Company, Country } from "@/lib/types";
import { exportToCsv, CsvColumn } from "@/lib/csv-export";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, RowActionButton } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/SlideOver";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Combobox } from "@/components/ui/Combobox";
import { QuickCreateModal } from "@/components/ui/QuickCreateModal";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";

import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";

const TYPE_TONE: Record<ClientType, string> = {
  A: "bg-primary-50 text-primary-600",
  B: "bg-warning-50 text-warning-700",
  C: "bg-surface-sunken text-ink-muted",
};

const CLIENTS_PAGE_COLUMNS: ColumnDef[] = [
  { key: "client_name", label: "Client Name", required: true },
  { key: "client_type", label: "Type" },
  { key: "company_name", label: "Company" },
  { key: "country_name", label: "Country" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "actions", label: "Actions", required: true },
];

import { FilterBar, FilterGroupConfig } from "@/components/ui/FilterBar";

const CLIENT_PAGE_FILTER_CONFIGS: FilterGroupConfig[] = [
  {
    key: "client_type",
    label: "Client Type",
    options: [
      { value: "A", label: "Type A (Enterprise)", dotColor: "#9333ea" },
      { value: "B", label: "Type B (Standard)", dotColor: "#2563eb" },
      { value: "C", label: "Type C (Small/Retail)", dotColor: "#d97706" },
    ],
  },
];

export default function ClientsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [cols, setCols] = useState<Set<string>>(new Set(CLIENTS_PAGE_COLUMNS.map((c) => c.key)));
  const debouncedSearch = useDebouncedValue(search);
  const { items: countries } = useList<Country>("/api/countries/");
  const { items: companies } = useList<Company>("/api/companies/");

  const clientFilterConfigs: FilterGroupConfig[] = useMemo(() => [
    {
      key: "client_type",
      label: "Client Type",
      options: [
        { value: "A", label: "Type A (Enterprise)", dotColor: "#9333ea" },
        { value: "B", label: "Type B (Standard)", dotColor: "#2563eb" },
        { value: "C", label: "Type C (Small/Retail)", dotColor: "#d97706" },
      ],
    },
    {
      key: "company",
      label: "Company",
      options: companies.map((c) => ({ value: String(c.id), label: c.company_name })),
    },
    {
      key: "country",
      label: "Country",
      options: countries.map((c) => ({ value: c.code, label: c.name })),
    },
  ], [companies, countries]);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (typeFilter) params.set("client_type", typeFilter);
    if (companyFilter) params.set("company", companyFilter);
    if (countryFilter) params.set("country", countryFilter);
    params.set("page", String(page));
    return `/api/clients/?${params.toString()}`;
  }, [debouncedSearch, typeFilter, companyFilter, countryFilter, page]);

  const { data, loading, reload } = usePaginatedList<Client>(path);

  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);

  const canAdd = can("clients", "add");
  const canEdit = can("clients", "edit");
  const canDelete = can("clients", "delete");

  const activeFilters = {
    client_type: typeFilter,
    company: companyFilter,
    country: countryFilter,
  };

  function handleFilterChange(key: string, val: string) {
    if (key === "client_type") setTypeFilter(val);
    if (key === "company") setCompanyFilter(val);
    if (key === "country") setCountryFilter(val);
    setPage(1);
  }

  function handleResetFilters() {
    setTypeFilter("");
    setCompanyFilter("");
    setCountryFilter("");
    setSearch("");
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Clients"
        action={
          canAdd && (
            <Button variant="primary" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> Add Client
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
        searchPlaceholder="Search clients by name, email, phone..."
        filters={clientFilterConfigs}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                const list = data?.results || [];
                if (!list.length) return;
                const cols: CsvColumn<Client>[] = [
                  { header: "Client Name", accessor: (c) => c.client_name },
                  { header: "Type", accessor: (c) => c.client_type },
                  { header: "Company", accessor: (c) => c.company_name || "" },
                  { header: "Country", accessor: (c) => c.country_name || "" },
                  { header: "Phone", accessor: (c) => c.phone },
                  { header: "Email", accessor: (c) => c.email },
                  { header: "Address", accessor: (c) => c.address },
                ];
                exportToCsv(list, cols, "clients_export");
              }}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <ColumnSelector columns={CLIENTS_PAGE_COLUMNS} visibleColumns={cols} onChange={setCols} />
          </div>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {cols.has("client_name") && <th className={TH}>Client Name</th>}
                {cols.has("client_type") && <th className={TH}>Type</th>}
                {cols.has("company_name") && <th className={TH}>Company</th>}
                {cols.has("country_name") && <th className={TH}>Country</th>}
                {cols.has("phone") && <th className={TH}>Phone</th>}
                {cols.has("email") && <th className={TH}>Email</th>}
                {cols.has("actions") && <th className={TH}></th>}
              </tr>
            </thead>
            <tbody>
              <TableState loading={loading} empty={!loading && (data?.results.length ?? 0) === 0} colSpan={cols.size} emptyLabel="No clients yet." />
              {data?.results.map((c) => (
                <tr key={c.id} className={TR}>
                  {cols.has("client_name") && (
                    <td className={`${TD} font-semibold`}>
                      <Link href={`/clients/${c.id}`} className="text-ink hover:text-primary-600 transition-colors">
                        {c.client_name}
                      </Link>
                    </td>
                  )}
                  {cols.has("client_type") && (
                    <td className={TD}>
                      <span className={clsx("inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold", TYPE_TONE[c.client_type])}>
                        {c.client_type}
                      </span>
                    </td>
                  )}
                  {cols.has("company_name") && (
                    <td className={`${TD} text-ink-muted`}>
                      {c.company ? (
                        <Link href={`/companies/${c.company}`} className="text-ink hover:text-primary-600 transition-colors">
                          {c.company_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  {cols.has("country_name") && <td className={`${TD} text-ink-muted`}>{c.country_name || "—"}</td>}
                  {cols.has("phone") && <td className={`${TD} text-ink-muted`}>{c.phone || "—"}</td>}
                  {cols.has("email") && <td className={`${TD} text-ink-muted`}>{c.email || "—"}</td>}
                  {cols.has("actions") && (
                    <td className={`${TD} text-right`}>
                      <div className="flex justify-end gap-1">
                        <Link href={`/clients/${c.id}`}>
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

      <SlideOver open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add Client" : "Edit Client"}>
        {editing !== null && (
          <ClientForm
            key={editing === "new" ? "new" : editing.id}
            client={editing === "new" ? null : editing}
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
          title="Delete client"
          description={`Delete "${deleting.client_name}"? This can be undone later from the archive.`}
          onConfirm={async () => {
            try {
              await apiFetch(`/api/clients/${deleting.id}/`, { method: "DELETE" });
              toast.success("Client deleted.");
              setDeleting(null);
              reload();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Couldn't delete this client.");
            }
          }}
        />
      )}
    </div>
  );
}

export function ClientForm({
  client,
  countries,
  defaultCompanyId,
  onCancel,
  onSaved,
}: {
  client: Client | null;
  countries: Country[];
  defaultCompanyId?: number;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    client_name: client?.client_name ?? "",
    client_type: client?.client_type ?? ("B" as ClientType),
    company: client?.company ?? defaultCompanyId ?? ("" as string | number),
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    address: client?.address ?? "",
    country: client?.country ?? ("" as string | number),
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!companiesLoaded) {
    setCompaniesLoaded(true);
    apiFetch<Paginated<Company>>("/api/companies/?page_size=200")
      .then((res) => setCompanies(res.results))
      .catch(() => {});
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const companyOptions = companies.map((c) => ({ value: c.id, label: c.company_name }));
  const countryOptions = countries.map((c) => ({ value: c.code, label: c.name, sublabel: c.currency_code }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, company: form.company || null, country: form.country || null };
      if (client) {
        await apiFetch(`/api/clients/${client.id}/`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Client updated.");
      } else {
        await apiFetch("/api/clients/", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Client added.");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Client Name" required>
          <Input value={form.client_name} onChange={(e) => set("client_name", e.target.value)} required autoFocus />
        </Field>

        <Field label="Client Type" required>
          <div className="grid grid-cols-3 gap-2">
            {(["A", "B", "C"] as ClientType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set("client_type", t)}
                className={clsx(
                  "h-10 rounded-md border text-sm font-bold transition-colors",
                  form.client_type === t ? "border-primary-400 bg-primary-50 text-primary-600" : "border-border bg-white text-ink-muted hover:bg-surface-hover",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Company">
          <Combobox
            value={form.company || null}
            onChange={(v) => set("company", v)}
            options={companyOptions}
            placeholder="Select company..."
            onAddNew={() => setQuickAddOpen(true)}
            addNewLabel="Add new company"
          />
        </Field>

        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>

        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>

        <Field label="Country" hint="Drives the default currency on this client's quotations.">
          <Combobox value={form.country || null} onChange={(v) => set("country", v)} options={countryOptions} placeholder="Select country..." />
        </Field>

        <Field label="Address">
          <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>

        {error && <p className="text-[13px] font-medium text-primary-600">{error}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Save Client
          </Button>
        </div>
      </form>

      <QuickCreateModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        title="Add Company"
        label="Company Name"
        onCreate={async (name) => {
          const created = await apiFetch<Company>("/api/companies/", {
            method: "POST",
            body: JSON.stringify({ company_name: name }),
          });
          setCompanies((prev) => [...prev, created]);
          set("company", created.id);
          toast.success("Company added.");
        }}
      />
    </>
  );
}
