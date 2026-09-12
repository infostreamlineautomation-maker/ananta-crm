"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, Layers, Pencil, Plus, Search, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError, Paginated } from "@/lib/api";
import { usePaginatedList, useList, useDebouncedValue } from "@/lib/hooks";
import { Client, ClientGroup, ClientType, Company, Country, CustomFieldDefinition } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { ExportColumn } from "@/lib/export-utils";
import { ClientGroupModal } from "@/components/clients/ClientGroupModal";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, RowActionButton } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/SlideOver";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Combobox } from "@/components/ui/Combobox";
import { QuickCreateModal } from "@/components/ui/QuickCreateModal";
import { CompanyForm } from "../companies/CompanyForm";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { DynamicFormFields } from "@/components/custom-fields/DynamicFormFields";
import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";
import { FilterBar } from "@/components/ui/FilterBar";
import { ColumnHeaderFilter } from "@/components/ui/ColumnHeaderFilter";
import { DynamicFilterColumn, useDynamicColumnFilters } from "@/lib/useDynamicColumnFilters";

const TYPE_TONE: Record<ClientType, string> = {
  A: "bg-primary-50 text-primary-600",
  B: "bg-warning-50 text-warning-700",
  C: "bg-surface-sunken text-ink-muted",
};

const CLIENTS_EXPORT_COLUMNS: ExportColumn<Client>[] = [
  { header: "Client Name", accessor: (c) => c.client_name, category: "Basic Info" },
  { header: "Client Type / Tier", accessor: (c) => `Tier ${c.client_type}`, category: "Basic Info" },
  { header: "Company Name", accessor: (c) => c.company_name || "", category: "Basic Info" },
  { header: "Phone Number", accessor: (c) => c.phone, category: "Contact Info" },
  { header: "Email Address", accessor: (c) => c.email, category: "Contact Info" },
  { header: "Address", accessor: (c) => c.address, category: "Contact Info" },
  { header: "Country", accessor: (c) => c.country_name || "", category: "Contact Info" },
  { header: "Currency Code", accessor: (c) => c.currency_code || "INR", category: "Financials" },
  { header: "Created Date", accessor: (c) => formatDate(c.created_at), category: "System Dates" },
];

const CLIENTS_PAGE_COLUMNS: ColumnDef[] = [
  { key: "select", label: "Checkbox", required: true },
  { key: "client_name", label: "Client Name", required: true },
  { key: "client_type", label: "Type" },
  { key: "company_name", label: "Company" },
  { key: "country_name", label: "Country" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "address", label: "Address" },
  { key: "groups", label: "Groups" },
  { key: "currency_code", label: "Currency" },
  { key: "created_at", label: "Created Date" },
  { key: "actions", label: "Actions", required: true },
];

export default function ClientsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [cols, setCols] = useState<Set<string>>(new Set(CLIENTS_PAGE_COLUMNS.map((c) => c.key)));
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const { items: countries } = useList<Country>("/api/countries/");
  const { items: clientGroups, reload: reloadGroups } = useList<ClientGroup>("/api/client-groups/");
  const { items: allClients, reload: reloadAllClients } = useList<Client>("/api/clients/?page_size=300");

  const [selectedGroup, setSelectedGroup] = useState<number | "all">("all");
  const [groupModalOpen, setGroupModalOpen] = useState(false);

  const baseFilterColumns: DynamicFilterColumn[] = useMemo(
    () => [
      {
        key: "client_name",
        label: "Client Name",
        type: "text",
      },
      {
        key: "client_type",
        label: "Client Type",
        type: "select",
        options: [
          { value: "A", label: "Type A (Enterprise)", dotColor: "#9333ea" },
          { value: "B", label: "Type B (Standard)", dotColor: "#2563eb" },
          { value: "C", label: "Type C (Small/Retail)", dotColor: "#d97706" },
        ],
      },
      {
        key: "company",
        label: "Company",
        type: "text",
      },
      {
        key: "country",
        label: "Country",
        type: "select",
        options: countries.map((c) => ({ value: c.code, label: c.name })),
      },
      {
        key: "phone",
        label: "Phone",
        type: "text",
      },
      {
        key: "email",
        label: "Email",
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
    module: "client",
    baseColumns: baseFilterColumns,
  });

  const allColumns: ColumnDef[] = useMemo(() => {
    const base = [...CLIENTS_PAGE_COLUMNS];
    const actionCol = base.pop()!;
    const dynamicCols: ColumnDef[] = (customFields || []).map((f) => ({
      key: `extra_${f.field_key}`,
      label: f.label,
    }));
    return [...base, ...dynamicCols, actionCol];
  }, [customFields]);

  useEffect(() => {
    if (customFields && customFields.length > 0) {
      setCols((prev) => {
        const next = new Set(prev);
        customFields.forEach((f) => {
          if (f.show_in_table) next.add(`extra_${f.field_key}`);
        });
        return next;
      });
    }
  }, [customFields]);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (selectedGroup !== "all") params.set("groups", String(selectedGroup));
    appendQueryParams(params);
    params.set("page", String(page));
    return `/api/clients/?${params.toString()}`;
  }, [debouncedSearch, selectedGroup, appendQueryParams, page]);

  const { data, loading, reload } = usePaginatedList<Client>(path);

  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);

  const canAdd = can("clients", "add");
  const canEdit = can("clients", "edit");
  const canDelete = can("clients", "delete");

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
    if (!confirm(`Are you sure you want to delete ${selected.size} clients?`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all(
        Array.from(selected).map((id) => apiFetch(`/api/clients/${id}/`, { method: "DELETE" }))
      );
      toast.success(`Deleted ${selected.size} clients.`);
      setSelected(new Set());
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't delete some clients.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const fullExportColumns = useMemo(() => {
    const base = [...CLIENTS_EXPORT_COLUMNS];
    if (customFields && customFields.length > 0) {
      customFields.forEach((f) => {
        base.push({
          header: f.label,
          accessor: (c: Client) => String(c.extra_data?.[f.field_key] ?? ""),
          category: "Custom Attributes",
        });
      });
    }
    return base;
  }, [customFields]);

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

      {selected.size > 0 ? (
        <div className="flex items-center justify-between rounded-md border border-primary-100 bg-primary-50 px-4 py-2.5">
          <span className="text-[13.5px] font-semibold text-primary-700">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <ExportDropdown
              data={data?.results || []}
              selectedIds={selected}
              filename="clients_export"
              title="Clients Directory"
              columns={fullExportColumns}
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
          searchPlaceholder="Search clients by name, email, phone..."
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
                filename="clients_export"
                title="Clients Directory"
                columns={fullExportColumns}
              />
              <ColumnSelector columns={allColumns} visibleColumns={cols} onChange={setCols} />
            </div>
          }
        />
      )}

      {/* Client Group Filter Tabs */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 text-xs -mt-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mr-1 flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-primary-600" />
            Group:
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedGroup("all");
              setPage(1);
            }}
            className={clsx(
              "px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 border text-xs",
              selectedGroup === "all"
                ? "bg-primary-600 text-white border-primary-600 shadow-xs"
                : "bg-white text-ink-muted hover:text-ink hover:bg-sand-50 border-border"
            )}
          >
            All Clients
          </button>
          {clientGroups.map((grp) => {
            const isSelected = selectedGroup === grp.id;
            const count = grp.clients_count ?? (grp.clients?.length || 0);
            return (
              <button
                key={grp.id}
                type="button"
                onClick={() => {
                  setSelectedGroup(grp.id);
                  setPage(1);
                }}
                className={clsx(
                  "px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 border text-xs",
                  isSelected
                    ? "bg-primary-50 text-primary-800 border-primary-300 shadow-xs ring-1 ring-primary-300"
                    : "bg-white text-ink hover:text-primary-700 hover:bg-sand-50 border-border"
                )}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: grp.color || "#881337" }}
                />
                <span>{grp.name}</span>
                <span
                  className={clsx(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold leading-none",
                    isSelected
                      ? "bg-primary-200/80 text-primary-900"
                      : "bg-sand-100 text-ink-muted"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setGroupModalOpen(true)}
          className="shrink-0 text-xs text-ink font-medium h-7.5 border-dashed"
        >
          <Plus className="h-3.5 w-3.5 mr-1 text-primary-600" />
          Manage Groups
        </Button>
      </div>

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
                {cols.has("client_name") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Client Name</span>
                      {getColFilter("client_name") && (
                        <ColumnHeaderFilter
                          column={getColFilter("client_name")!}
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
                {cols.has("client_type") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Type</span>
                      {getColFilter("client_type") && (
                        <ColumnHeaderFilter
                          column={getColFilter("client_type")!}
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
                {cols.has("designation") && <th className={TH}>Designation</th>}
                {cols.has("company_name") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Company</span>
                      {getColFilter("company") && (
                        <ColumnHeaderFilter
                          column={getColFilter("company")!}
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
                {cols.has("phone") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Phone</span>
                      {getColFilter("phone") && (
                        <ColumnHeaderFilter
                          column={getColFilter("phone")!}
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
                  <th className={TH}>
                    <div className="inline-flex items-center">
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
                {cols.has("address") && <th className={TH}>Address</th>}
                {cols.has("groups") && <th className={TH}>Groups</th>}
                {cols.has("currency_code") && <th className={TH}>Currency</th>}
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
              <TableState loading={loading} empty={!loading && (data?.results.length ?? 0) === 0} colSpan={cols.size} emptyLabel="No clients yet." />
              {data?.results.map((c) => (
                <tr key={c.id} className={TR}>
                  {cols.has("select") && (
                    <td className="w-10 px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelectOne(c.id)}
                        className="h-3.5 w-3.5 rounded border-border-strong text-primary-500 focus:ring-primary-500/20"
                      />
                    </td>
                  )}
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
                  {cols.has("address") && <td className={`${TD} text-ink-muted max-w-[200px] truncate`} title={c.address}>{c.address || "—"}</td>}
                  {cols.has("groups") && (
                    <td className={TD}>
                      {(() => {
                        const matchedGroups = clientGroups.filter((g) => c.group_ids?.includes(g.id));
                        if (matchedGroups.length === 0) return <span className="text-ink-muted">—</span>;
                        return (
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {matchedGroups.map((grp) => (
                              <span
                                key={grp.id}
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold text-ink border border-border bg-surface-sunken"
                              >
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: grp.color || "#881337" }} />
                                {grp.name}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                  )}
                  {cols.has("currency_code") && <td className={`${TD} text-ink-muted font-mono font-medium`}>{c.currency_code || "INR"}</td>}
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

      <ClientGroupModal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        groups={clientGroups}
        allClients={allClients}
        onGroupsChanged={() => {
          reloadGroups();
          reloadAllClients();
          reload();
        }}
      />
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
  onSaved: (savedClient?: Client) => void;
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
  const [extraData, setExtraData] = useState<Record<string, any>>(client?.extra_data || {});
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Paginated<any>>("/api/custom-fields/?module=client")
      .then((res) => setCustomFields(res.results || []))
      .catch(() => {});
  }, []);

  const loadCompanies = useCallback(() => {
    apiFetch<Paginated<Company>>("/api/companies/?page_size=200")
      .then((res) => {
        setCompanies(res.results);
        setCompaniesLoaded(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

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
      const payload = {
        ...form,
        company: form.company || null,
        country: form.country || null,
        extra_data: extraData,
      };
      if (client) {
        const updated = await apiFetch<Client>(`/api/clients/${client.id}/`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Client updated.");
        onSaved(updated);
      } else {
        const created = await apiFetch<Client>("/api/clients/", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Client added.");
        onSaved(created);
      }
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
                  "h-10 rounded-md border text-sm font-bold transition-colors cursor-pointer",
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
            Save Client
          </Button>
        </div>
      </form>

      <SlideOver
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        title="Add New Company"
        size="lg"
        zIndex={50}
      >
        <CompanyForm
          company={null}
          countries={countries}
          onCancel={() => setQuickAddOpen(false)}
          onSaved={(created) => {
            if (created) {
              setCompanies((prev) => [...prev, created]);
              set("company", created.id);
            }
            setQuickAddOpen(false);
          }}
        />
      </SlideOver>
    </>
  );
}
