"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { usePaginatedList, useList, useDebouncedValue } from "@/lib/hooks";
import { Client, ProjectSummary } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { exportToCsv, CsvColumn } from "@/lib/csv-export";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Combobox } from "@/components/ui/Combobox";
import { StatusPill, PROJECT_STATUS_TONE, labelize } from "@/components/ui/StatusPill";
import { TableState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";

import { FilterBar, FilterGroupConfig } from "@/components/ui/FilterBar";

const PROJECT_PAGE_FILTER_CONFIGS: FilterGroupConfig[] = [
  {
    key: "status",
    label: "Status",
    options: [
      { value: "active", label: "Active", dotColor: "#16a34a" },
      { value: "on_hold", label: "On Hold", dotColor: "#d97706" },
      { value: "completed", label: "Completed", dotColor: "#2563eb" },
      { value: "cancelled", label: "Cancelled", dotColor: "#e11d48" },
    ],
  },
];

export default function ProjectsPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);
  const [addOpen, setAddOpen] = useState(false);

  const { items: clients } = useList<Client>("/api/clients/");

  const projectFilterConfigs: FilterGroupConfig[] = useMemo(() => [
    {
      key: "client",
      label: "Client",
      options: clients.map((c) => ({ value: String(c.id), label: c.client_name })),
    },
    {
      key: "status",
      label: "Status",
      options: [
        { value: "active", label: "Active", dotColor: "#16a34a" },
        { value: "on_hold", label: "On Hold", dotColor: "#d97706" },
        { value: "completed", label: "Completed", dotColor: "#2563eb" },
        { value: "cancelled", label: "Cancelled", dotColor: "#e11d48" },
      ],
    },
  ], [clients]);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    if (clientFilter) params.set("client", clientFilter);
    params.set("page", String(page));
    return `/api/projects/?${params.toString()}`;
  }, [debouncedSearch, statusFilter, clientFilter, page]);

  const { data, loading, reload } = usePaginatedList<ProjectSummary>(path);
  const canAdd = can("projects", "add");

  const activeFilters = {
    status: statusFilter,
    client: clientFilter,
  };

  function handleFilterChange(key: string, val: string) {
    if (key === "status") setStatusFilter(val);
    if (key === "client") setClientFilter(val);
    setPage(1);
  }

  function handleResetFilters() {
    setStatusFilter("");
    setClientFilter("");
    setSearch("");
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Projects"
        action={
          canAdd && (
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> New Project
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
        searchPlaceholder="Search projects by name, client..."
        filters={projectFilterConfigs}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              const list = data?.results || [];
              if (!list.length) return;
              const cols: CsvColumn<ProjectSummary>[] = [
                { header: "Project Name", accessor: (p) => p.name },
                { header: "Client", accessor: (p) => p.client_name },
                { header: "Status", accessor: (p) => p.status },
                { header: "Orders Count", accessor: (p) => p.orders_count },
                { header: "Quotations Count", accessor: (p) => p.quotations_count },
                { header: "Total Order Value", accessor: (p) => p.total_order_value },
                { header: "Description", accessor: (p) => p.description },
              ];
              exportToCsv(list, cols, "projects_export");
            }}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        }
      />

      {loading && <p className="text-sm text-ink-faint">Loading...</p>}
      {!loading && (data?.results.length ?? 0) === 0 && (
        <Card className="px-5 py-12 text-center text-sm text-ink-faint">No projects yet.</Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.results.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`}>
            <Card className="flex h-full flex-col gap-2 p-5 transition-shadow hover:shadow-[var(--shadow-pop)]">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-ink">{p.name}</h3>
                <StatusPill label={labelize(p.status)} tone={PROJECT_STATUS_TONE[p.status]} />
              </div>
              <p className="text-[13px] text-ink-muted">{p.client_name}</p>
              <div className="mt-auto flex items-center gap-1.5 pt-3 text-[12.5px] text-ink-faint">
                <span>{p.orders_count} Orders</span>
                <span>·</span>
                <span>{p.quotations_count} Quotations</span>
                <span>·</span>
                <span className="font-semibold text-ink">{formatCurrency(p.total_order_value)}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {data && data.count > 0 && (
        <Card>
          <Pagination count={data.count} page={page} onPageChange={setPage} />
        </Card>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New Project">
        <ProjectForm onCancel={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); reload(); }} />
      </Modal>
    </div>
  );
}

export function ProjectForm({
  project,
  onCancel,
  onSaved,
}: {
  project?: ProjectSummary;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { items: clients } = useList<Client>("/api/clients/?page_size=200");
  const [name, setName] = useState(project?.name ?? "");
  const [client, setClient] = useState<number | "">(project?.client ?? "");
  const [status, setStatus] = useState(project?.status ?? "active");
  const [description, setDescription] = useState(project?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.client_name }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!client) {
      setError("Pick a client for this project.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { name, client, status, description };
      if (project) {
        await apiFetch(`/api/projects/${project.id}/`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Project updated.");
      } else {
        await apiFetch("/api/projects/", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Project created.");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Project Name" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </Field>
      <Field label="Client" required>
        <Combobox value={client || null} onChange={(v) => setClient(Number(v))} options={clientOptions} placeholder="Select client..." />
      </Field>
      <Field label="Status">
        <Select value={status} onChange={(e) => setStatus(e.target.value as "active" | "on_hold" | "completed" | "cancelled")}>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </Field>
      <Field label="Description">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {error && <p className="text-[13px] font-medium text-primary-600">{error}</p>}
      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          {project ? "Save Project" : "Create Project"}
        </Button>
      </div>
    </form>
  );
}
