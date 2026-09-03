"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, MessageSquare, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { usePaginatedList, useList, useDebouncedValue } from "@/lib/hooks";
import { Client, Company, Country, OrderSummary } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportToCsv, CsvColumn } from "@/lib/csv-export";
import { SendNotificationModal } from "@/components/notifications/SendNotificationModal";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, RowActionButton } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill, DELIVERY_STATUS_TONE, PAYMENT_STATUS_TONE, labelize } from "@/components/ui/StatusPill";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";
import { FilterBar, FilterGroupConfig } from "@/components/ui/FilterBar";

const ORDERS_COLUMNS: ColumnDef[] = [
  { key: "select", label: "Checkbox", required: true },
  { key: "order_no", label: "Order No", required: true },
  { key: "date", label: "Date" },
  { key: "client_name", label: "Client" },
  { key: "project_name", label: "Project" },
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
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [projectScope, setProjectScope] = useState<"" | "false" | "true">("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [cols, setCols] = useState<Set<string>>(new Set(ORDERS_COLUMNS.map((c) => c.key)));
  const [deleting, setDeleting] = useState<OrderSummary | null>(null);
  const [notifyingOrder, setNotifyingOrder] = useState<OrderSummary | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const { items: clients } = useList<Client>("/api/clients/");
  const { items: companies } = useList<Company>("/api/companies/");
  const { items: countries } = useList<Country>("/api/countries/");

  const orderFilterConfigs: FilterGroupConfig[] = useMemo(() => [
    {
      key: "client",
      label: "Client",
      options: clients.map((c) => ({ value: String(c.id), label: c.client_name })),
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
    {
      key: "delivery_status",
      label: "Delivery",
      options: [
        { value: "pending", label: "Pending", dotColor: "#64748b" },
        { value: "in_process", label: "In Process", dotColor: "#2563eb" },
        { value: "ready", label: "Ready", dotColor: "#0d9488" },
        { value: "delivered", label: "Delivered", dotColor: "#16a34a" },
      ],
    },
    {
      key: "payment_status",
      label: "Payment",
      options: [
        { value: "pending", label: "Pending", dotColor: "#e11d48" },
        { value: "partial", label: "Partial", dotColor: "#d97706" },
        { value: "paid", label: "Paid", dotColor: "#16a34a" },
      ],
    },
    {
      key: "amount",
      label: "Amount",
      type: "amount_range",
    },
    {
      key: "date",
      label: "Date",
      type: "date_range",
    },
  ], [clients, companies, countries]);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (deliveryFilter) params.set("delivery_status", deliveryFilter);
    if (paymentFilter) params.set("payment_status", paymentFilter);
    if (clientFilter) params.set("client", clientFilter);
    if (companyFilter) params.set("client__company", companyFilter);
    if (countryFilter) params.set("country", countryFilter);
    if (amountMin) params.set("min_amount", amountMin);
    if (amountMax) params.set("max_amount", amountMax);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (projectScope) params.set("has_project", projectScope);
    params.set("page", String(page));
    return `/api/orders/?${params.toString()}`;
  }, [
    debouncedSearch,
    deliveryFilter,
    paymentFilter,
    clientFilter,
    companyFilter,
    countryFilter,
    amountMin,
    amountMax,
    dateFrom,
    dateTo,
    projectScope,
    page,
  ]);

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
      toast.success(`${selected.size} order${selected.size === 1 ? "" : "s"} deleted.`);
      setSelected(new Set());
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't delete some orders.");
    } finally {
      setBulkDeleting(false);
    }
  }

  const activeFilters = {
    delivery_status: deliveryFilter,
    payment_status: paymentFilter,
    client: clientFilter,
    company: companyFilter,
    country: countryFilter,
    amount_min: amountMin,
    amount_max: amountMax,
    date_from: dateFrom,
    date_to: dateTo,
  };

  function handleFilterChange(key: string, val: string) {
    if (key === "delivery_status") setDeliveryFilter(val);
    if (key === "payment_status") setPaymentFilter(val);
    if (key === "client") setClientFilter(val);
    if (key === "company") setCompanyFilter(val);
    if (key === "country") setCountryFilter(val);
    if (key === "amount_min") setAmountMin(val);
    if (key === "amount_max") setAmountMax(val);
    if (key === "date_from") setDateFrom(val);
    if (key === "date_to") setDateTo(val);
    setPage(1);
  }

  function handleResetFilters() {
    setDeliveryFilter("");
    setPaymentFilter("");
    setClientFilter("");
    setCompanyFilter("");
    setCountryFilter("");
    setAmountMin("");
    setAmountMax("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Orders"
        action={
          canAdd && (
            <Link href="/orders/new">
              <Button variant="primary">
                <Plus className="h-4 w-4" /> New Order
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
          searchPlaceholder="Search order no, description..."
          filters={orderFilterConfigs}
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-border bg-surface-sunken p-0.5">
                <button
                  onClick={() => {
                    setProjectScope("");
                    setPage(1);
                  }}
                  className={clsx(
                    "rounded-md px-2.5 py-1 text-[12px] font-semibold transition-all",
                    projectScope === "" ? "bg-white text-primary-600 shadow-xs" : "text-ink-muted hover:text-ink",
                  )}
                >
                  All
                </button>
                <button
                  onClick={() => {
                    setProjectScope("false");
                    setPage(1);
                  }}
                  className={clsx(
                    "rounded-md px-2.5 py-1 text-[12px] font-semibold transition-all",
                    projectScope === "false" ? "bg-white text-primary-600 shadow-xs" : "text-ink-muted hover:text-ink",
                  )}
                >
                  Standalone
                </button>
                <button
                  onClick={() => {
                    setProjectScope("true");
                    setPage(1);
                  }}
                  className={clsx(
                    "rounded-md px-2.5 py-1 text-[12px] font-semibold transition-all",
                    projectScope === "true" ? "bg-white text-primary-600 shadow-xs" : "text-ink-muted hover:text-ink",
                  )}
                >
                  Project
                </button>
              </div>

              <Button
                variant="secondary"
                onClick={() => {
                  const list = data?.results || [];
                  if (!list.length) return;
                  const cols: CsvColumn<OrderSummary>[] = [
                    { header: "Order No", accessor: (o) => o.order_no },
                    { header: "Date", accessor: (o) => o.date },
                    { header: "Client", accessor: (o) => o.client_name },
                    { header: "Project", accessor: (o) => o.project_name || "" },
                    { header: "Supplier", accessor: (o) => o.supplier_name || "" },
                    { header: "Currency", accessor: (o) => o.currency_code || "INR" },
                    { header: "Total Amount", accessor: (o) => o.grand_total },
                    { header: "Paid Amount", accessor: (o) => o.paid_amount || "0.00" },
                    { header: "Balance Due", accessor: (o) => o.due_amount || "0.00" },
                    { header: "Delivery Status", accessor: (o) => o.delivery_status },
                    { header: "Payment Status", accessor: (o) => o.payment_status },
                  ];
                  exportToCsv(list, cols, "orders_export");
                }}
                className="h-9 gap-1.5 text-xs font-semibold"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>

              <ColumnSelector columns={ORDERS_COLUMNS} visibleColumns={cols} onChange={setCols} />
            </div>
          }
        />
      )}

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
                      className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)]"
                    />
                  </th>
                )}
                {cols.has("order_no") && <th className={TH}>Order No</th>}
                {cols.has("date") && <th className={TH}>Date</th>}
                {cols.has("client_name") && <th className={TH}>Client</th>}
                {cols.has("project_name") && <th className={TH}>Project</th>}
                {cols.has("grand_total") && <th className={`${TH} text-right`}>Total Amount</th>}
                {cols.has("paid_amount") && <th className={`${TH} text-right`}>Paid Amount</th>}
                {cols.has("due_amount") && <th className={`${TH} text-right`}>Balance Due</th>}
                {cols.has("delivery_status") && <th className={TH}>Delivery Status</th>}
                {cols.has("payment_status") && <th className={TH}>Payment Status</th>}
                {cols.has("actions") && <th className={`${TH} text-right`}>Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <TableState
                loading={loading}
                empty={!loading && (data?.results.length ?? 0) === 0}
                colSpan={cols.size}
                emptyLabel="No orders found matching criteria."
              />
              {data?.results.map((o) => (
                <tr key={o.id} className={`${TR} hover:bg-surface-hover transition-colors`}>
                  {cols.has("select") && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(o.id)}
                        onChange={() => toggle(o.id)}
                        className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)]"
                      />
                    </td>
                  )}
                  {cols.has("order_no") && (
                    <td className={TD}>
                      <Link href={`/orders/${o.id}`} className="font-mono text-[13px] font-semibold text-ink hover:text-primary-500">
                        {o.order_no}
                      </Link>
                    </td>
                  )}
                  {cols.has("date") && <td className={`${TD} text-ink-muted`}>{formatDate(o.date)}</td>}
                  {cols.has("client_name") && <td className={`${TD} text-ink`}>{o.client_name}</td>}
                  {cols.has("project_name") && <td className={`${TD} text-ink-muted`}>{o.project_name || "—"}</td>}
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
                          <RowActionButton label="Print Invoice / Bill" onClick={() => {}}>
                            <Printer className="h-3.5 w-3.5 text-primary-600" />
                          </RowActionButton>
                        </Link>
                        <Link href={`/orders/${o.id}`}>
                          <RowActionButton label="View" onClick={() => {}}>
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

      {notifyingOrder && (
        <SendNotificationModal
          open
          onClose={() => setNotifyingOrder(null)}
          target={{
            type: "order",
            id: notifyingOrder.id,
            title: `Order ${notifyingOrder.order_no}`,
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
          title="Delete order"
          description={`Delete "${deleting.order_no}"? This cannot be undone.`}
          onConfirm={async () => {
            try {
              await apiFetch(`/api/orders/${deleting.id}/`, { method: "DELETE" });
              toast.success("Order deleted.");
              setDeleting(null);
              reload();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Couldn't delete this order.");
            }
          }}
        />
      )}
    </div>
  );
}
