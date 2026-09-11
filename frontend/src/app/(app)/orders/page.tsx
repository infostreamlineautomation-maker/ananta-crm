"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, Layers, MessageSquare, Pencil, Plus, Printer, Search, Trash2, Image as ImageIcon } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { usePaginatedList, useList, useDebouncedValue } from "@/lib/hooks";
import { Client, ClientGroup, Company, Country, OrderImage, OrderSummary } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
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

const ORDERS_COLUMNS: ColumnDef[] = [
  { key: "select", label: "Checkbox", required: true },
  { key: "order_no", label: "Project No", required: true },
  { key: "images", label: "Images" },
  { key: "date", label: "Date" },
  { key: "client_name", label: "Client" },
  { key: "grand_total", label: "Total Amount" },
  { key: "paid_amount", label: "Paid Amount" },
  { key: "due_amount", label: "Balance Due" },
  { key: "delivery_status", label: "Delivery Status" },
  { key: "payment_status", label: "Payment Status" },
  { key: "actions", label: "Actions", required: true },
];

export default function OrdersPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [cols, setCols] = useState<Set<string>>(new Set(ORDERS_COLUMNS.map((c) => c.key)));
  const [deleting, setDeleting] = useState<OrderSummary | null>(null);
  const [notifyingOrder, setNotifyingOrder] = useState<OrderSummary | null>(null);
  const [activeLightboxImages, setActiveLightboxImages] = useState<OrderImage[] | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const { items: countries } = useList<Country>("/api/countries/");
  const { items: clientGroups, reload: reloadGroups } = useList<ClientGroup>("/api/client-groups/");
  const { items: allClients, reload: reloadClients } = useList<Client>("/api/clients/?page_size=300");

  const [selectedGroup, setSelectedGroup] = useState<number | "all">("all");
  const [groupModalOpen, setGroupModalOpen] = useState(false);

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
          <div className="flex gap-2">
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
                filename="projects_export"
                title="Projects Report"
                columns={[
                  { header: "Project No", accessor: (o) => o.order_no },
                  { header: "Project Name", accessor: (o) => o.project_title || "" },
                  { header: "Date", accessor: (o) => o.date },
                  { header: "Client", accessor: (o) => o.company_name ? `${o.client_name} (${o.company_name})` : o.client_name },
                  { header: "Company", accessor: (o) => o.company_name || "" },
                  { header: "Supplier", accessor: (o) => o.supplier_name || "" },
                  { header: "Currency", accessor: (o) => o.currency_code || "INR" },
                  { header: "Total Amount", accessor: (o) => o.grand_total },
                  { header: "Paid Amount", accessor: (o) => o.paid_amount || "0.00" },
                  { header: "Balance Due", accessor: (o) => o.due_amount || "0.00" },
                  { header: "Delivery Status", accessor: (o) => o.delivery_status },
                  { header: "Payment Status", accessor: (o) => o.payment_status },
                ]}
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
                      {o.project_title && (
                        <div className="text-[12px] font-medium text-ink-muted truncate max-w-[180px]" title={o.project_title}>
                          {o.project_title}
                        </div>
                      )}
                    </td>
                  )}
                  {cols.has("images") && (
                    <td className={TD}>
                      {o.images && o.images.length > 0 ? (
                        <div
                          onClick={() => setActiveLightboxImages(o.images || [])}
                          className="flex items-center -space-x-2 overflow-hidden hover:opacity-80 transition-opacity cursor-pointer w-fit"
                          title={`View ${o.images.length} image${o.images.length === 1 ? "" : "s"}`}
                        >
                          {o.images.slice(0, 3).map((img, idx) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={img.id || idx}
                              src={img.image}
                              alt="thumb"
                              className="inline-block h-8 w-8 rounded-md border-2 border-white bg-surface-sunken object-cover shadow-xs"
                            />
                          ))}
                          {o.images.length > 3 && (
                            <span className="flex h-8 w-8 items-center justify-center rounded-md border-2 border-white bg-slate-700 text-[10px] font-bold text-white shadow-xs">
                              +{o.images.length - 3}
                            </span>
                          )}
                        </div>
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
                        {o.company_name && (
                          <span className="text-[12px] font-medium text-ink-muted">
                            ({o.company_name})
                          </span>
                        )}
                      </div>
                    </td>
                  )}
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
                  {cols.has("actions") && (
                    <td className={`${TD} text-right`}>
                      <div className="flex justify-end gap-1">
                        <RowActionButton label="Send Notification (WhatsApp / Email)" onClick={() => setNotifyingOrder(o)}>
                          <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                        </RowActionButton>
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
