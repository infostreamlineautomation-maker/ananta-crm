"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Download, Eye, Layers, MessageSquare, Pencil, Plus, Printer, Search, Trash2, Image as ImageIcon } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { usePaginatedList, useList, useDebouncedValue } from "@/lib/hooks";
import { Client, ClientGroup, Company, Country, OrderDetail, OrderImage, OrderSummary } from "@/lib/types";
import { formatCurrency, formatDate, mediaUrl } from "@/lib/format";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { SendNotificationModal } from "@/components/notifications/SendNotificationModal";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";
import { ClientGroupModal } from "@/components/clients/ClientGroupModal";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, RowActionButton } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill, DELIVERY_STATUS_TONE, PAYMENT_STATUS_TONE, labelize } from "@/components/ui/StatusPill";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";
import { FilterBar } from "@/components/ui/FilterBar";
import { ColumnHeaderFilter } from "@/components/ui/ColumnHeaderFilter";
import { DynamicFilterColumn, useDynamicColumnFilters } from "@/lib/useDynamicColumnFilters";
import { ExportColumn } from "@/lib/export-utils";

const PROJECTS_EXPORT_COLUMNS: ExportColumn<any>[] = [
  { header: "Project No", accessor: (o: any) => o.order_no, category: "Basic Info" },
  { header: "Project Name / Title", accessor: (o: any) => o.project_title || o.project_name || "", category: "Basic Info" },
  { header: "Order Date", accessor: (o: any) => o.date, category: "Basic Info" },
  { header: "Client Name", accessor: (o: any) => o.client_name || "", category: "Client & Vendor" },
  { header: "Company Name", accessor: (o: any) => o.company_name || "", category: "Client & Vendor" },
  { header: "Supplier / Vendor", accessor: (o: any) => o.supplier_name || "", category: "Client & Vendor" },
  { header: "Client Phone", accessor: (o: any) => o.client_phone || "", category: "Client & Vendor" },
  { header: "Client Email", accessor: (o: any) => o.client_email || "", category: "Client & Vendor" },
  { header: "Currency", accessor: (o: any) => o.currency_code || "INR", category: "Financials & Tax" },
  { header: "Total (Without GST)", accessor: (o: any) => o.subtotal || o.grand_total, category: "Financials & Tax" },
  { header: "GST %", accessor: (o: any) => o.tax_percent ?? "0", category: "Financials & Tax" },
  { header: "GST Tax Amount", accessor: (o: any) => o.tax_amount || "0.00", category: "Financials & Tax" },
  { header: "Total Bill (With GST)", accessor: (o: any) => o.grand_total, category: "Financials & Tax" },
  { header: "Advance / Paid Amount", accessor: (o: any) => o.paid_amount || "0.00", category: "Financials & Tax" },
  { header: "Balance Due", accessor: (o: any) => o.due_amount || "0.00", category: "Financials & Tax" },
  { header: "Delivery Status", accessor: (o: any) => labelize(o.delivery_status), category: "Workflow & Status" },
  { header: "Payment Status", accessor: (o: any) => labelize(o.payment_status), category: "Workflow & Status" },
  { header: "Delivery Deadline / Time", accessor: (o: any) => o.delivery_time || "", category: "Workflow & Status" },
  {
    header: "Line Items Summary",
    accessor: (o: any) =>
      o.items?.map((it: any, idx: number) => `${idx + 1}. ${it.product_name || "Item"}${it.description ? ` (${it.description})` : ""} - Qty: ${it.qty} @ ${it.rate}`).join(" | ") ||
      o.items_preview ||
      "",
    category: "Line Items & Proofs",
  },
  {
    header: "Proof / Artwork Images URLs",
    accessor: (o: any) =>
      o.images?.map((img: any) => mediaUrl(img.image)).filter(Boolean).join(", ") || "",
    category: "Line Items & Proofs",
  },
  { header: "Remarks / Notes", accessor: (o: any) => o.remarks || "", category: "Workflow & Status" },
  { header: "Created Date", accessor: (o: any) => o.created_at ? formatDate(o.created_at) : "", category: "System Dates" },
];

const ORDERS_COLUMNS: ColumnDef[] = [
  { key: "select", label: "Checkbox", required: true },
  { key: "order_no", label: "Project No", required: true },
  { key: "project_title", label: "Project Name / Title", defaultVisible: false },
  { key: "images", label: "Images" },
  { key: "date", label: "Date" },
  { key: "client_name", label: "Client" },
  { key: "company_name", label: "Company", defaultVisible: false },
  { key: "supplier_name", label: "Supplier / Vendor", defaultVisible: false },
  { key: "delivery_time", label: "Delivery Deadline / Time", defaultVisible: false },
  { key: "description", label: "Remarks / Notes", defaultVisible: false },
  { key: "currency_code", label: "Currency", defaultVisible: false },
  { key: "subtotal", label: "Total (Without GST)", defaultVisible: false },
  { key: "tax_percent", label: "GST %", defaultVisible: false },
  { key: "tax_amount", label: "GST Tax Amount", defaultVisible: false },
  { key: "grand_total", label: "Total Amount" },
  { key: "paid_amount", label: "Paid Amount" },
  { key: "due_amount", label: "Balance Due" },
  { key: "delivery_status", label: "Delivery Status" },
  { key: "payment_status", label: "Payment Status" },
  { key: "created_at", label: "Created Date", defaultVisible: false },
  { key: "updated_at", label: "Updated Date", defaultVisible: false },
  { key: "actions", label: "Actions", required: true },
];

export default function OrdersPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [cols, setCols] = useState<Set<string>>(
    new Set(["select", "order_no", "images", "date", "client_name", "grand_total", "paid_amount", "due_amount", "delivery_status", "payment_status", "actions"])
  );
  const [deleting, setDeleting] = useState<OrderSummary | null>(null);
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const [notifyingOrder, setNotifyingOrder] = useState<OrderSummary | null>(null);
  const [activeLightboxImages, setActiveLightboxImages] = useState<OrderImage[] | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const { items: countries } = useList<Country>("/api/countries/");
  const { items: clientGroups, reload: reloadGroups } = useList<ClientGroup>("/api/client-groups/");
  const { items: allClients, reload: reloadClients } = useList<Client>("/api/clients/?page_size=300");

  const [selectedGroup, setSelectedGroup] = useState<number | "all">("all");
  const [groupModalOpen, setGroupModalOpen] = useState(false);

  async function handleCopyOrder(orderId: number) {
    setCopyingId(orderId);
    try {
      const copy = await apiFetch<OrderDetail>(`/api/orders/${orderId}/copy/`, {
        method: "POST",
        body: JSON.stringify({ date: new Date().toISOString().slice(0, 10) }),
      });
      toast.success(`Copied to ${copy.order_no}.`);
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't duplicate this project.");
    } finally {
      setCopyingId(null);
    }
  }

  const baseFilterColumns: DynamicFilterColumn[] = useMemo(
    () => [
      {
        key: "order_no",
        label: "Project No",
        type: "text",
      },
      {
        key: "client_name",
        label: "Client",
        type: "text",
      },
      {
        key: "delivery_status",
        label: "Delivery Status",
        type: "select",
        options: [
          { value: "pending", label: "Pending", dotColor: "#64748b" },
          { value: "in_process", label: "In Process", dotColor: "#2563eb" },
          { value: "ready", label: "Ready", dotColor: "#0d9488" },
          { value: "delivered", label: "Delivered", dotColor: "#16a34a" },
        ],
      },
      {
        key: "payment_status",
        label: "Payment Status",
        type: "select",
        options: [
          { value: "pending", label: "Pending", dotColor: "#e11d48" },
          { value: "advance", label: "Advance", dotColor: "#0284c7" },
          { value: "partial", label: "Partial", dotColor: "#d97706" },
          { value: "paid", label: "Paid", dotColor: "#16a34a" },
        ],
      },
      {
        key: "amount",
        label: "Total Amount",
        type: "amount_range",
      },
      {
        key: "date",
        label: "Date",
        type: "date_range",
      },
    ],
    []
  );

  const {
    columns: filterColumns,
    activeFilters,
    setFilter,
    resetFilters,
    appendQueryParams,
  } = useDynamicColumnFilters({
    module: "order_item",
    baseColumns: baseFilterColumns,
  });

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (selectedGroup !== "all") params.set("client_group", String(selectedGroup));
    appendQueryParams(params);
    params.set("page", String(page));
    return `/api/orders/?${params.toString()}`;
  }, [debouncedSearch, selectedGroup, appendQueryParams, page]);

  const { data, loading, reload } = usePaginatedList<OrderSummary>(path);

  const canAdd = can("orders", "add");
  const canEdit = can("orders", "edit");
  const canDelete = can("orders", "delete");

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!data) return;
    setSelected((prev) => (prev.size === data.results.length ? new Set() : new Set(data.results.map((o) => o.id))));
  }

  async function bulkDelete() {
    setBulkDeleting(true);
    try {
      await Promise.all(Array.from(selected).map((id) => apiFetch(`/api/orders/${id}/`, { method: "DELETE" })));
      toast.success(`${selected.size} project${selected.size === 1 ? "" : "s"} deleted.`);
      setSelected(new Set());
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't delete some projects.");
    } finally {
      setBulkDeleting(false);
    }
  }

  const getColFilter = (key: string) => filterColumns.find((c) => c.key === key);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Projects"
        action={
          canAdd && (
            <Link href="/orders/new">
              <Button variant="primary">
                <Plus className="h-4 w-4" /> New Project
              </Button>
            </Link>
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
              filename="projects_export"
              title="Projects Report"
              columns={PROJECTS_EXPORT_COLUMNS}
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
          searchPlaceholder="Search project no, description..."
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
                filename="projects_export"
                title="Projects Report"
                columns={PROJECTS_EXPORT_COLUMNS}
              />

              <ColumnSelector columns={ORDERS_COLUMNS} visibleColumns={cols} onChange={setCols} />
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
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken/40 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                {cols.has("select") && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={!!data && data.results.length > 0 && selected.size === data.results.length}
                      onChange={toggleAll}
                      aria-label="Select all"
                      className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)] cursor-pointer"
                    />
                  </th>
                )}
                {cols.has("order_no") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Project No</span>
                      {getColFilter("order_no") && (
                        <ColumnHeaderFilter
                          column={getColFilter("order_no")!}
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
                {cols.has("project_title") && <th className={TH}>Project Name / Title</th>}
                {cols.has("images") && <th className={TH}>Images</th>}
                {cols.has("date") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Date</span>
                      {getColFilter("date") && (
                        <ColumnHeaderFilter
                          column={getColFilter("date")!}
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
                {cols.has("client_name") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Client</span>
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
                {cols.has("company_name") && <th className={TH}>Company</th>}
                {cols.has("supplier_name") && <th className={TH}>Supplier / Vendor</th>}
                {cols.has("delivery_time") && <th className={TH}>Delivery Deadline</th>}
                {cols.has("description") && <th className={TH}>Remarks / Notes</th>}
                {cols.has("currency_code") && <th className={TH}>Currency</th>}
                {cols.has("subtotal") && <th className={`${TH} text-right`}>Total (Without GST)</th>}
                {cols.has("tax_percent") && <th className={`${TH} text-right`}>GST %</th>}
                {cols.has("tax_amount") && <th className={`${TH} text-right`}>GST Amount</th>}
                {cols.has("grand_total") && (
                  <th className={`${TH} text-right`}>
                    <div className="inline-flex items-center justify-end">
                      <span>Total Amount</span>
                      {getColFilter("amount") && (
                        <ColumnHeaderFilter
                          column={getColFilter("amount")!}
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
                {cols.has("paid_amount") && <th className={`${TH} text-right`}>Paid Amount</th>}
                {cols.has("due_amount") && <th className={`${TH} text-right`}>Balance Due</th>}
                {cols.has("delivery_status") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Delivery Status</span>
                      {getColFilter("delivery_status") && (
                        <ColumnHeaderFilter
                          column={getColFilter("delivery_status")!}
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
                {cols.has("payment_status") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Payment Status</span>
                      {getColFilter("payment_status") && (
                        <ColumnHeaderFilter
                          column={getColFilter("payment_status")!}
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
                {cols.has("created_at") && <th className={TH}>Created Date</th>}
                {cols.has("updated_at") && <th className={TH}>Updated Date</th>}
                {cols.has("actions") && <th className={`${TH} text-right`}>Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <TableState
                loading={loading}
                empty={!loading && (data?.results.length ?? 0) === 0}
                colSpan={cols.size}
                emptyLabel="No projects found matching criteria."
              />
              {data?.results.map((o) => (
                <tr key={o.id} className={`${TR} hover:bg-surface-hover transition-colors`}>
                  {cols.has("select") && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(o.id)}
                        onChange={() => toggle(o.id)}
                        className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)] cursor-pointer"
                      />
                    </td>
                  )}
                  {cols.has("order_no") && (
                    <td className={TD}>
                      <Link href={`/orders/${o.id}`} className="font-mono text-[13px] font-semibold text-ink hover:text-primary-500">
                        {o.order_no}
                      </Link>
                      {!cols.has("project_title") && o.project_title && (
                        <div className="text-[12px] font-medium text-ink-muted truncate max-w-[180px]" title={o.project_title}>
                          {o.project_title}
                        </div>
                      )}
                    </td>
                  )}
                  {cols.has("project_title") && (
                    <td className={`${TD} font-medium text-ink max-w-[200px] truncate`} title={o.project_title || ""}>
                      {o.project_title || "—"}
                    </td>
                  )}
                  {cols.has("images") && (
                    <td className={TD}>
                      {o.images && o.images.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setActiveLightboxImages(o.images || [])}
                          className="group relative flex items-center justify-center rounded-lg border border-border/90 bg-white p-1 shadow-xs transition-all hover:border-primary-500 hover:shadow-md cursor-pointer focus:outline-hidden"
                          title={`Click to view ${o.images.length} image${o.images.length === 1 ? "" : "s"} in high-res gallery`}
                        >
                          <div className="relative h-18 w-20 sm:h-20 sm:w-24 overflow-hidden rounded-md bg-surface-sunken/60 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={o.images[0].image}
                              alt={o.images[0].caption || "Proof preview"}
                              className="h-full w-full object-contain p-0.5 transition-transform duration-200 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10 flex items-center justify-center">
                              <ImageIcon className="h-5 w-5 text-white opacity-0 drop-shadow-md transition-opacity group-hover:opacity-100" />
                            </div>
                          </div>
                          {o.images.length > 1 && (
                            <span className="absolute -bottom-1 -right-1 flex items-center gap-0.5 rounded-full bg-slate-900/90 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-white shadow-xs ring-1.5 ring-white">
                              +{o.images.length - 1}
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className="text-ink-faint text-xs">—</span>
                      )}
                    </td>
                  )}
                  {cols.has("date") && <td className={`${TD} text-ink-muted`}>{formatDate(o.date)}</td>}
                  {cols.has("client_name") && (
                    <td className={TD}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-ink">{o.client_name}</span>
                        {!cols.has("company_name") && o.company_name && (
                          <span className="text-[12px] font-medium text-ink-muted">
                            ({o.company_name})
                          </span>
                        )}
                      </div>
                    </td>
                  )}
                  {cols.has("company_name") && <td className={`${TD} text-ink-muted`}>{o.company_name || "—"}</td>}
                  {cols.has("supplier_name") && <td className={`${TD} text-ink-muted`}>{o.supplier_name || "—"}</td>}
                  {cols.has("delivery_time") && <td className={`${TD} text-ink-muted max-w-[160px] truncate`} title={o.delivery_time || ""}>{o.delivery_time || "—"}</td>}
                  {cols.has("description") && <td className={`${TD} text-ink-muted max-w-[180px] truncate`} title={o.description || ""}>{o.description || "—"}</td>}
                  {cols.has("currency_code") && <td className={`${TD} font-mono text-xs text-ink-muted`}>{o.currency_code || "INR"}</td>}
                  {cols.has("subtotal") && <td className={`${TD} tnum text-right text-ink-muted`}>{formatCurrency(o.subtotal || o.grand_total, o.currency_code)}</td>}
                  {cols.has("tax_percent") && <td className={`${TD} tnum text-right text-ink-muted`}>{o.tax_percent ?? "0"}%</td>}
                  {cols.has("tax_amount") && <td className={`${TD} tnum text-right text-ink-muted`}>{formatCurrency(o.tax_amount || "0.00", o.currency_code)}</td>}
                  {cols.has("grand_total") && (
                    <td className={`${TD} tnum text-right font-semibold text-ink`}>{formatCurrency(o.grand_total, o.currency_code)}</td>
                  )}
                  {cols.has("paid_amount") && (
                    <td className={`${TD} tnum text-right font-medium text-emerald-700`}>
                      {formatCurrency(o.paid_amount || "0.00", o.currency_code)}
                    </td>
                  )}
                  {cols.has("due_amount") && (
                    <td className={`${TD} tnum text-right font-bold ${Number(o.due_amount) > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                      {formatCurrency(o.due_amount || "0.00", o.currency_code)}
                    </td>
                  )}
                  {cols.has("delivery_status") && (
                    <td className={TD}>
                      <StatusPill label={labelize(o.delivery_status)} tone={DELIVERY_STATUS_TONE[o.delivery_status]} />
                    </td>
                  )}
                  {cols.has("payment_status") && (
                    <td className={TD}>
                      <StatusPill
                        label={
                          o.payment_status === "partial" && o.due_amount
                            ? `Partial (Due: ${formatCurrency(o.due_amount, o.currency_code)})`
                            : labelize(o.payment_status)
                        }
                        tone={PAYMENT_STATUS_TONE[o.payment_status]}
                      />
                    </td>
                  )}
                  {cols.has("created_at") && <td className={`${TD} text-xs text-ink-muted`}>{o.created_at ? formatDate(o.created_at) : "—"}</td>}
                  {cols.has("updated_at") && <td className={`${TD} text-xs text-ink-muted`}>{o.updated_at ? formatDate(o.updated_at) : "—"}</td>}
                  {cols.has("actions") && (
                    <td className={`${TD} text-right`}>
                      <div className="flex justify-end gap-1">
                        <RowActionButton label="Send Notification (WhatsApp / Email)" onClick={() => setNotifyingOrder(o)}>
                          <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                        </RowActionButton>
                        {canAdd && (
                          <RowActionButton
                            label="Duplicate / Copy Project"
                            onClick={() => handleCopyOrder(o.id)}
                            loading={copyingId === o.id}
                          >
                            <Copy className="h-3.5 w-3.5 text-slate-600" />
                          </RowActionButton>
                        )}
                        <Link href={`/orders/${o.id}/print`} target="_blank">
                          <RowActionButton label="Print Bill / PDF" onClick={() => {}}>
                            <Printer className="h-3.5 w-3.5 text-primary-600" />
                          </RowActionButton>
                        </Link>
                        <Link href={`/orders/${o.id}`}>
                          <RowActionButton label="View / Edit" onClick={() => {}}>
                            {canEdit ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </RowActionButton>
                        </Link>
                        {canDelete && (
                          <RowActionButton label="Delete" tone="danger" onClick={() => setDeleting(o)}>
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

      {activeLightboxImages && (
        <ImageLightboxModal
          open={true}
          onClose={() => setActiveLightboxImages(null)}
          images={activeLightboxImages}
        />
      )}

      {notifyingOrder && (
        <SendNotificationModal
          open
          onClose={() => setNotifyingOrder(null)}
          target={{
            type: "order",
            id: notifyingOrder.id,
            title: `Project ${notifyingOrder.order_no}`,
            clientName: notifyingOrder.client_name,
            orderNo: notifyingOrder.order_no,
            amount: notifyingOrder.grand_total,
            paidAmount: notifyingOrder.paid_amount,
            dueAmount: notifyingOrder.due_amount,
            currency: notifyingOrder.currency_code || "INR",
            date: notifyingOrder.date,
            status: notifyingOrder.delivery_status,
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          open
          onClose={() => setDeleting(null)}
          title="Delete project"
          description={`Delete "${deleting.order_no}"? This cannot be undone.`}
          onConfirm={async () => {
            try {
              await apiFetch(`/api/orders/${deleting.id}/`, { method: "DELETE" });
              toast.success("Project deleted.");
              setDeleting(null);
              reload();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Couldn't delete this project.");
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
          reloadClients();
          reload();
        }}
      />
    </div>
  );
}
