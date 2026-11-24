"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2, ChevronDown, Copy, CreditCard, Download, Eye, Layers, MessageSquare, Pencil, Plus, Printer, Receipt, Search, Trash2, Zap, Image as ImageIcon } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/organization-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useInfinitePaginatedList, useList, useDebouncedValue } from "@/lib/hooks";
import { Client, ClientGroup, Company, Country, OrderDetail, OrderImage, OrderSummary } from "@/lib/types";
import { formatCurrency, formatDate, mediaUrl } from "@/lib/format";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { SendNotificationModal } from "@/components/notifications/SendNotificationModal";
import { QuickPaymentModal } from "@/components/orders/QuickPaymentModal";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";
import { ClientGroupModal } from "@/components/clients/ClientGroupModal";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, RowActionButton } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill, DELIVERY_STATUS_TONE, PAYMENT_STATUS_TONE, labelize } from "@/components/ui/StatusPill";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";
import { ResizableTh } from "@/components/ui/ResizableTh";
import { useTableGrid } from "@/lib/useTableGrid";
import { FilterBar } from "@/components/ui/FilterBar";
import { ColumnHeaderFilter } from "@/components/ui/ColumnHeaderFilter";
import { DynamicFilterColumn, useDynamicColumnFilters } from "@/lib/useDynamicColumnFilters";
import { ExportColumn } from "@/lib/export-utils";

const PROJECTS_EXPORT_COLUMNS: ExportColumn<any>[] = [
  { header: "Project No", accessor: (o: any) => o.order_no, category: "Basic Info", defaultSelected: true },
  { header: "Project Name / Title", accessor: (o: any) => o.project_title || o.project_name || "", category: "Basic Info", defaultSelected: true },
  { header: "Product", accessor: (o: any) => o.product_names || (o.items?.map((it: any) => it.product_name).filter(Boolean).join(", ") || ""), category: "Basic Info", defaultSelected: true },
  {
    header: "Quantity (QTY)",
    accessor: (o: any) => {
      if (o.total_qty !== undefined && o.total_qty !== null && o.total_qty !== 0) return o.total_qty;
      if (o.items && o.items.length > 0) {
        return o.items.reduce((acc: number, it: any) => acc + Number(it.qty || 0), 0);
      }
      return "";
    },
    category: "Basic Info",
    defaultSelected: true,
  },
  {
    header: "Rate",
    accessor: (o: any) => {
      if (o.rates_preview) return o.rates_preview;
      if (o.items && o.items.length > 0) {
        return o.items.map((it: any) => it.rate).join(", ");
      }
      return "";
    },
    category: "Basic Info",
    defaultSelected: true,
  },
  { header: "Order Date", accessor: (o: any) => o.date, category: "Basic Info", defaultSelected: true },
  { header: "Client Name", accessor: (o: any) => o.client_name || "", category: "Client & Vendor", defaultSelected: true },
  { header: "Company Name", accessor: (o: any) => o.company_name || "", category: "Client & Vendor", defaultSelected: false },
  { header: "Supplier / Vendor", accessor: (o: any) => o.supplier_name || "", category: "Client & Vendor", defaultSelected: false },
  { header: "Client Phone", accessor: (o: any) => o.client_phone || "", category: "Client & Vendor", defaultSelected: false },
  { header: "Client Email", accessor: (o: any) => o.client_email || "", category: "Client & Vendor", defaultSelected: false },
  { header: "Currency", accessor: (o: any) => o.currency_code || "INR", category: "Financials & Tax", defaultSelected: false },
  { header: "Total (Without GST)", accessor: (o: any) => o.subtotal || o.grand_total, category: "Financials & Tax", defaultSelected: false },
  { header: "GST %", accessor: (o: any) => o.tax_percent ?? "0", category: "Financials & Tax", defaultSelected: false },
  { header: "GST Tax Amount", accessor: (o: any) => o.tax_amount || "0.00", category: "Financials & Tax", defaultSelected: false },
  { header: "Total Bill (With GST)", accessor: (o: any) => o.grand_total, category: "Financials & Tax", defaultSelected: true },
  { header: "Advance / Paid Amount", accessor: (o: any) => o.paid_amount || "0.00", category: "Financials & Tax", defaultSelected: true },
  { header: "Balance Due", accessor: (o: any) => o.due_amount || "0.00", category: "Financials & Tax", defaultSelected: true },
  { header: "Delivery Status", accessor: (o: any) => labelize(o.delivery_status), category: "Workflow & Status", defaultSelected: true },
  { header: "Payment Status", accessor: (o: any) => labelize(o.payment_status), category: "Workflow & Status", defaultSelected: true },
  { header: "Delivery Deadline / Time", accessor: (o: any) => o.delivery_time || "", category: "Workflow & Status", defaultSelected: false },
  {
    header: "Line Items Summary",
    accessor: (o: any) =>
      o.items?.map((it: any, idx: number) => `${idx + 1}. ${it.product_name || "Item"}${it.description ? ` (${it.description})` : ""} - Qty: ${it.qty} @ ${it.rate}`).join(" | ") ||
      o.items_preview ||
      "",
    category: "Line Items & Proofs",
    defaultSelected: false,
  },
  {
    header: "Image Preview",
    accessor: (o: any) => {
      const count = o.images?.length || 0;
      return count > 0 ? `${count} Image${count > 1 ? "s" : ""}` : "-";
    },
    imageAccessor: (o: any) => {
      if (o.images && o.images.length > 0) {
        const firstImg = o.images[0]?.image;
        return firstImg ? mediaUrl(firstImg) : null;
      }
      return null;
    },
    category: "Line Items & Proofs",
    defaultSelected: true,
  },
  { header: "Remarks / Notes", accessor: (o: any) => o.remarks || "", category: "Workflow & Status", defaultSelected: false },
  { header: "Created Date", accessor: (o: any) => o.created_at ? formatDate(o.created_at) : "", category: "System Dates", defaultSelected: false },
];

const ORDERS_COLUMNS: ColumnDef[] = [
  { key: "select", label: "Checkbox", required: true },
  { key: "order_no", label: "Project No", required: true },
  { key: "project_title", label: "Project Name / Title", defaultVisible: false },
  { key: "product_name", label: "Product", defaultVisible: false },
  { key: "qty", label: "Quantity (QTY)", defaultVisible: false },
  { key: "rate", label: "Rate", defaultVisible: false },
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
  const { can, isClientUser } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const filteredColumns = useMemo(() => {
    if (isClientUser) {
      return ORDERS_COLUMNS.filter((col) => col.key !== "supplier_name");
    }
    return ORDERS_COLUMNS;
  }, [isClientUser]);

  const grid = useTableGrid({
    tableKey: isClientUser ? "portal_orders" : "orders",
    defaultColumns: filteredColumns,
    defaultVisibleKeys: [
      "select",
      "order_no",
      "images",
      "date",
      "client_name",
      "grand_total",
      "paid_amount",
      "due_amount",
      "delivery_status",
      "payment_status",
      "actions",
    ],
  });
  const [deleting, setDeleting] = useState<OrderSummary | null>(null);
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const [notifyingOrder, setNotifyingOrder] = useState<OrderSummary | null>(null);
  const [activeLightboxImages, setActiveLightboxImages] = useState<OrderImage[] | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const { items: countries } = useList<Country>("/api/countries/");
  const { items: clientGroups, reload: reloadGroups } = useList<ClientGroup>("/api/client-groups/");
  const { items: allClients, reload: reloadClients } = useList<Client>("/api/clients/?page_size=300");

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
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
        key: "project_title",
        label: "Project Name / Title",
        type: "text",
      },
      {
        key: "product_name",
        label: "Product",
        type: "text",
      },
      {
        key: "date",
        label: "Date",
        type: "date_range",
      },
      {
        key: "client_name",
        label: "Client",
        type: "text",
      },
      {
        key: "company_name",
        label: "Company",
        type: "text",
      },
      {
        key: "supplier_name",
        label: "Supplier / Vendor",
        type: "text",
      },
      {
        key: "delivery_time",
        label: "Delivery Deadline / Time",
        type: "text",
      },
      {
        key: "description",
        label: "Remarks / Notes",
        type: "text",
      },
      {
        key: "currency_code",
        label: "Currency",
        type: "select",
        options: [
          { value: "INR", label: "INR (₹)" },
          { value: "USD", label: "USD ($)" },
          { value: "EUR", label: "EUR (€)" },
          { value: "GBP", label: "GBP (£)" },
          { value: "AED", label: "AED (د.إ)" },
        ],
      },
      {
        key: "subtotal",
        label: "Total (Without GST)",
        type: "amount_range",
      },
      {
        key: "tax_percent",
        label: "GST %",
        type: "amount_range",
      },
      {
        key: "tax_amount",
        label: "GST Tax Amount",
        type: "amount_range",
      },
      {
        key: "grand_total",
        label: "Total Amount",
        type: "amount_range",
      },
      {
        key: "paid_amount",
        label: "Paid Amount",
        type: "amount_range",
      },
      {
        key: "due_amount",
        label: "Balance Due",
        type: "amount_range",
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
        key: "created_at",
        label: "Created Date",
        type: "date_range",
      },
      {
        key: "updated_at",
        label: "Updated Date",
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

  const basePath = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedClient) {
      params.set("client", String(selectedClient.id));
    } else if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }
    if (selectedGroup !== "all") params.set("client_group", String(selectedGroup));
    appendQueryParams(params);
    return `/api/orders/?${params.toString()}`;
  }, [selectedClient, debouncedSearch, selectedGroup, appendQueryParams]);

  const {
    items: orders,
    setItems: setOrders,
    count: totalCount,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    reload,
    extra,
  } = useInfinitePaginatedList<OrderSummary>(basePath);

  const [paymentOrder, setPaymentOrder] = useState<OrderSummary | null>(null);
  const [bulkPaying, setBulkPaying] = useState(false);

  function handleOrderPaymentUpdated(updated: OrderSummary) {
    setOrders((prev) =>
      prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
    );
  }

  async function bulkMarkPaid() {
    if (selected.size === 0) return;
    setBulkPaying(true);
    try {
      const selectedList = orders.filter((o) => selected.has(o.id));
      await Promise.all(
        selectedList.map((o) =>
          apiFetch(`/api/orders/${o.id}/`, {
            method: "PATCH",
            body: JSON.stringify({
              payment_status: "paid",
              paid_amount: Number(o.grand_total || 0),
            }),
          })
        )
      );
      toast.success(`${selected.size} project${selected.size === 1 ? "" : "s"} marked as Paid.`);
      setOrders((prev) =>
        prev.map((o) =>
          selected.has(o.id)
            ? {
                ...o,
                payment_status: "paid",
                paid_amount: o.grand_total,
                due_amount: "0.00",
              }
            : o
        )
      );
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't update payments.");
    } finally {
      setBulkPaying(false);
    }
  }

  const { activeOrganization } = useOrganization();
  const baseCurrency = extra?.converted_totals?.base_currency || activeOrganization?.default_currency_code || "INR";
  const displayCurrency = orders[0]?.currency_code || baseCurrency;

  // Calculates unified converted totals in base currency (e.g. INR) using exchange rates
  const effectiveTotals = useMemo(() => {
    // 1. If specific rows are selected via checkboxes, calculate strictly from selected rows
    if (selected.size > 0) {
      let grandTotal = 0;
      let paidAmount = 0;
      let dueAmount = 0;
      const currencyMap = new Map<string, { grandTotal: number; paidAmount: number; dueAmount: number }>();

      for (const o of orders) {
        if (selected.has(o.id)) {
          const curr = (o.currency_code || baseCurrency).toUpperCase();
          const rate = Number(o.exchange_rate || (curr === baseCurrency ? 1 : (extra?.currency_totals?.[curr]?.exchange_rate || 1)));
          const gt = Number(o.grand_total || 0);
          const pa = Number(o.paid_amount || 0);
          const da = Number(o.due_amount || 0);

          grandTotal += gt * rate;
          paidAmount += pa * rate;
          dueAmount += da * rate;

          const existing = currencyMap.get(curr) || { grandTotal: 0, paidAmount: 0, dueAmount: 0 };
          existing.grandTotal += gt;
          existing.paidAmount += pa;
          existing.dueAmount += da;
          currencyMap.set(curr, existing);
        }
      }

      const breakdown = Array.from(currencyMap.entries()).map(([currency, vals]) => ({ currency, ...vals }));
      const hasForeign = breakdown.some((b) => b.currency !== baseCurrency);

      return {
        baseCurrency,
        grandTotal,
        paidAmount,
        dueAmount,
        hasForeign,
        breakdown,
      };
    }

    // 2. Across all matching records from server
    if (extra?.converted_totals) {
      const breakdown = extra?.currency_totals
        ? Object.entries(extra.currency_totals).map(([curr, vals]: [string, any]) => ({
            currency: curr,
            grandTotal: Number(vals.grand_total || 0),
            paidAmount: Number(vals.paid_amount || 0),
            dueAmount: Number(vals.due_amount || 0),
          }))
        : [];
      const hasForeign = Boolean(extra.converted_totals.has_foreign_currency) || breakdown.some((b) => b.currency !== baseCurrency);

      return {
        baseCurrency: extra.converted_totals.base_currency || baseCurrency,
        grandTotal: Number(extra.converted_totals.grand_total || 0),
        paidAmount: Number(extra.converted_totals.paid_amount || 0),
        dueAmount: Number(extra.converted_totals.due_amount || 0),
        hasForeign,
        breakdown,
      };
    }

    // 3. Fallback: calculate from loaded orders
    let grandTotal = 0;
    let paidAmount = 0;
    let dueAmount = 0;
    const currencyMap = new Map<string, { grandTotal: number; paidAmount: number; dueAmount: number }>();

    for (const o of orders) {
      const curr = (o.currency_code || baseCurrency).toUpperCase();
      const rate = Number(o.exchange_rate || 1);
      const gt = Number(o.grand_total || 0);
      const pa = Number(o.paid_amount || 0);
      const da = Number(o.due_amount || 0);

      grandTotal += gt * rate;
      paidAmount += pa * rate;
      dueAmount += da * rate;

      const existing = currencyMap.get(curr) || { grandTotal: 0, paidAmount: 0, dueAmount: 0 };
      existing.grandTotal += gt;
      existing.paidAmount += pa;
      existing.dueAmount += da;
      currencyMap.set(curr, existing);
    }

    const breakdown = Array.from(currencyMap.entries()).map(([currency, vals]) => ({ currency, ...vals }));
    const hasForeign = breakdown.some((b) => b.currency !== baseCurrency);

    return {
      baseCurrency,
      grandTotal,
      paidAmount,
      dueAmount,
      hasForeign,
      breakdown,
    };
  }, [orders, selected, extra, baseCurrency]);

  const currencyTotals = useMemo(() => effectiveTotals.breakdown, [effectiveTotals]);

  const totalGrand = effectiveTotals.grandTotal;
  const totalPaid = effectiveTotals.paidAmount;
  const totalDue = effectiveTotals.dueAmount;

  const selectedTotals = useMemo(() => {
    if (selected.size === 0) return null;
    return {
      grandTotal: effectiveTotals.grandTotal,
      paidAmount: effectiveTotals.paidAmount,
      dueAmount: effectiveTotals.dueAmount,
    };
  }, [selected, effectiveTotals]);

  const canAdd = !isClientUser && can("orders", "add");
  const canEdit = !isClientUser && can("orders", "edit");
  const canDelete = !isClientUser && can("orders", "delete");

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === orders.length ? new Set() : new Set(orders.map((o) => o.id))));
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
    <div className="flex flex-col gap-4">
      {selected.size > 0 ? (
        <div className="flex items-center justify-between rounded-md border border-primary-100 bg-primary-50 px-4 py-2.5">
          <span className="text-[13.5px] font-semibold text-primary-700">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <ExportDropdown
              data={orders}
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
            {canEdit && (
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5 border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400 cursor-pointer font-bold"
                onClick={bulkMarkPaid}
                loading={bulkPaying}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Mark Paid ({selected.size})</span>
              </Button>
            )}
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
          }}
          searchPlaceholder="Search project no, client, description..."
          filters={filterColumns}
          activeFilters={activeFilters}
          onFilterChange={(k, v) => {
            setFilter(k, v);
          }}
          onReset={() => {
            resetFilters();
            setSearch("");
            setSelectedClient(null);
          }}
          clientSuggestions={allClients}
          selectedClient={selectedClient}
          onSelectClient={(c) => {
            setSelectedClient(c ? (allClients.find((cl) => cl.id === c.id) || (c as Client)) : null);
            setSearch("");
          }}
          actions={
            <div className="flex items-center gap-2">
              <ExportDropdown
                data={orders}
                selectedIds={selected}
                filename="projects_export"
                title="Projects Report"
                columns={PROJECTS_EXPORT_COLUMNS}
              />

              <ColumnSelector
                columns={grid.columns}
                visibleColumns={grid.visibleColumns}
                onChange={grid.setVisibleColumns}
                onReorder={grid.reorderColumns}
                onReset={grid.resetGrid}
              />

              {canAdd && (
                <Link href="/orders/new">
                  <Button variant="primary">
                    <Plus className="h-4 w-4" /> New Order
                  </Button>
                </Link>
              )}
            </div>
          }
        />
      )}

      {/* Client Group Filter Tabs */}
      {!isClientUser && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs -mt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mr-1 flex items-center gap-1 shrink-0">
              <Layers className="h-3.5 w-3.5 text-primary-600" />
              Group:
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedGroup("all");
              }}
              className={clsx(
                "px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 border text-xs cursor-pointer shrink-0",
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
                  }}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 border text-xs cursor-pointer shrink-0",
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
            <button
              type="button"
              onClick={() => setGroupModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ink-muted hover:text-ink hover:bg-surface-hover border border-dashed border-border transition-all flex items-center gap-1 cursor-pointer shrink-0"
              title="Create and manage client groups"
            >
              <Plus className="h-3.5 w-3.5 text-primary-600" />
              <span>Manage Groups</span>
            </button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-210px)] relative scrollbar-thin">
          <table className="w-full text-left text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-20">
              <tr className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                {grid.columns
                  .filter((col) => grid.visibleColumns.has(col.key))
                  .map((col) => {
                    if (col.key === "select") {
                      return (
                        <ResizableTh
                          key="select"
                          columnKey="select"
                          grid={grid}
                          isDraggable={false}
                          isResizable={false}
                          align="center"
                          className="w-10 px-3 text-center"
                        >
                          <input
                            type="checkbox"
                            checked={orders.length > 0 && selected.size === orders.length}
                            onChange={toggleAll}
                            aria-label="Select all"
                            className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)] cursor-pointer"
                          />
                        </ResizableTh>
                      );
                    }

                    if (col.key === "actions") {
                      return (
                        <ResizableTh
                          key="actions"
                          columnKey="actions"
                          grid={grid}
                          align="right"
                          isDraggable={false}
                        >
                          <span>Actions</span>
                        </ResizableTh>
                      );
                    }

                    const isRight = ["subtotal", "tax_percent", "tax_amount", "grand_total", "paid_amount", "due_amount"].includes(col.key);
                    const isCenter = ["qty", "rate", "currency_code", "date", "delivery_status", "payment_status", "delivery_time", "created_at", "updated_at"].includes(col.key);
                    const colAlign: "left" | "center" | "right" = isCenter ? "center" : isRight ? "right" : "left";
                    const colFilter = getColFilter(col.key) || (col.key === "grand_total" ? getColFilter("amount") : undefined) || (col.key === "amount" ? getColFilter("grand_total") : undefined);

                    return (
                      <ResizableTh
                        key={col.key}
                        columnKey={col.key}
                        grid={grid}
                        align={colAlign}
                      >
                        <div className={clsx("flex items-center gap-1 min-w-0 max-w-full", isCenter ? "justify-center" : isRight ? "justify-end" : "justify-start")}>
                          <span className="truncate">{col.label}</span>
                          {colFilter && (
                            <ColumnHeaderFilter
                              column={colFilter}
                              activeFilters={activeFilters}
                              onFilterChange={(k, v) => {
                                setFilter(k, v);
                              }}
                            />
                          )}
                        </div>
                      </ResizableTh>
                    );
                  })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <TableState
                loading={loading}
                empty={!loading && orders.length === 0}
                colSpan={grid.visibleColumns.size}
                emptyLabel="No projects found matching criteria."
              />
              {orders.map((o) => {
                const isFullPaid = o.payment_status === "paid" || (Number(o.due_amount) <= 0 && Number(o.grand_total) > 0);
                return (
                  <tr
                    key={o.id}
                    className={clsx(
                      TR,
                      "transition-colors",
                      isFullPaid ? "bg-emerald-50/70 hover:bg-emerald-100/60" : "hover:bg-surface-hover"
                    )}
                  >
                    {grid.columns
                    .filter((col) => grid.visibleColumns.has(col.key))
                    .map((col) => {
                      switch (col.key) {
                        case "select":
                          return (
                            <td key="select" className="px-4 py-3 border-b border-border/60">
                              <input
                                type="checkbox"
                                checked={selected.has(o.id)}
                                onChange={() => toggle(o.id)}
                                className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)] cursor-pointer"
                              />
                            </td>
                          );
                        case "order_no":
                          return (
                            <td key="order_no" className={TD}>
                              <Link href={`/orders/${o.id}`} className="font-mono text-[13px] font-semibold text-ink hover:text-primary-500">
                                {o.order_no}
                              </Link>
                              {!grid.visibleColumns.has("project_title") && o.project_title && (
                                <div className="text-[12px] font-medium text-ink-muted truncate max-w-[180px]" title={o.project_title}>
                                  {o.project_title}
                                </div>
                              )}
                            </td>
                          );
                        case "project_title":
                          return (
                            <td key="project_title" className={`${TD} font-medium text-ink max-w-[200px] truncate`} title={o.project_title || ""}>
                              {o.project_title || "—"}
                            </td>
                          );
                        case "product_name":
                          return (
                            <td key="product_name" className={`${TD} font-medium text-ink max-w-[200px] truncate`} title={o.product_names || (o.items?.map((it: any) => it.product_name).filter(Boolean).join(", ") || "")}>
                              {o.product_names || (o.items?.map((it: any) => it.product_name).filter(Boolean).join(", ") || "—")}
                            </td>
                          );
                        case "qty": {
                          const items = o.items || [];
                          let displayQty: string | number = o.total_qty !== undefined && o.total_qty !== null && o.total_qty !== 0 ? o.total_qty : "—";
                          const hasMultiple = items.length > 1;

                          if (items.length > 0) {
                            const sum = items.reduce((acc: number, it: any) => acc + Number(it.qty || 0), 0);
                            displayQty = sum > 0 ? sum.toLocaleString() : "—";
                          }

                          return (
                            <td key="qty" className={`${TD} tnum text-center font-semibold text-ink whitespace-nowrap`}>
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="inline-block px-2 py-0.5 rounded bg-surface-sunken/60 text-ink font-semibold">
                                  {displayQty !== "—" ? displayQty : "—"}
                                </span>
                                {hasMultiple && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-sunken text-ink-muted border border-border"
                                    title={items.map((it: any, idx: number) => `Item ${idx + 1}: ${Number(it.qty || 0).toLocaleString()} pcs`).join("\n")}
                                  >
                                    {items.length} items
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        }
                        case "rate": {
                          const items = o.items || [];
                          const curr = o.currency_code;
                          return (
                            <td key="rate" className={`${TD} tnum text-center font-medium text-ink whitespace-nowrap`}>
                              <div className="flex items-center justify-center">
                                {items.length === 1 ? (
                                  <span>{formatCurrency(items[0].rate, curr)}</span>
                                ) : items.length > 1 ? (
                                  <span title={items.map((it: any, idx: number) => `Item ${idx + 1}: ${formatCurrency(it.rate, curr)}`).join("\n")}>
                                    {formatCurrency(items[0].rate, curr)}
                                    <span className="text-[10.5px] text-ink-muted ml-1 font-normal">
                                      (+{items.length - 1})
                                    </span>
                                  </span>
                                ) : o.rates_preview ? (
                                  <span>{o.rates_preview}</span>
                                ) : (
                                  <span className="text-ink-muted">—</span>
                                )}
                              </div>
                            </td>
                          );
                        }
                        case "images":
                          return (
                            <td key="images" className={TD}>
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
                          );
                        case "date":
                          return <td key="date" className={`${TD} text-center text-ink-muted whitespace-nowrap`}>{formatDate(o.date)}</td>;
                        case "client_name":
                          return (
                            <td key="client_name" className={TD}>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-ink">{o.client_name}</span>
                                {!grid.visibleColumns.has("company_name") && o.company_name && (
                                  <span className="text-[12px] font-medium text-ink-muted">
                                    ({o.company_name})
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        case "company_name":
                          return <td key="company_name" className={`${TD} text-ink-muted`}>{o.company_name || "—"}</td>;
                        case "supplier_name":
                          return <td key="supplier_name" className={`${TD} text-ink-muted`}>{o.supplier_name || "—"}</td>;
                        case "delivery_time":
                          return <td key="delivery_time" className={`${TD} text-center text-ink-muted max-w-[160px] truncate`} title={o.delivery_time || ""}>{o.delivery_time || "—"}</td>;
                        case "description":
                          return <td key="description" className={`${TD} text-ink-muted max-w-[180px] truncate`} title={o.description || ""}>{o.description || "—"}</td>;
                        case "currency_code":
                          return (
                            <td key="currency_code" className={`${TD} text-center font-mono text-xs whitespace-nowrap`}>
                              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-surface-sunken text-ink-muted border border-border/70 font-semibold text-[11px]">
                                {o.currency_code || "INR"}
                              </span>
                            </td>
                          );
                        case "subtotal":
                          return <td key="subtotal" className={`${TD} tnum text-right text-ink-muted`}>{formatCurrency(o.subtotal || o.grand_total, o.currency_code)}</td>;
                        case "tax_percent":
                          return <td key="tax_percent" className={`${TD} tnum text-right text-ink-muted`}>{o.tax_percent ?? "0"}%</td>;
                        case "tax_amount":
                          return <td key="tax_amount" className={`${TD} tnum text-right text-ink-muted`}>{formatCurrency(o.tax_amount || "0.00", o.currency_code)}</td>;
                        case "grand_total":
                          return (
                            <td key="grand_total" className={`${TD} tnum text-right font-semibold text-ink`}>
                              {formatCurrency(o.grand_total, o.currency_code)}
                            </td>
                          );
                        case "paid_amount":
                          return (
                            <td key="paid_amount" className={`${TD} tnum text-right font-medium text-emerald-700`}>
                              {formatCurrency(o.paid_amount || "0.00", o.currency_code)}
                            </td>
                          );
                        case "due_amount":
                          return (
                            <td key="due_amount" className={`${TD} tnum text-right font-bold ${Number(o.due_amount) > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                              {formatCurrency(o.due_amount || "0.00", o.currency_code)}
                            </td>
                          );
                        case "delivery_status":
                          return (
                            <td key="delivery_status" className={`${TD} text-center`}>
                              <div className="flex justify-center">
                                <StatusPill label={labelize(o.delivery_status)} tone={DELIVERY_STATUS_TONE[o.delivery_status]} />
                              </div>
                            </td>
                          );
                        case "payment_status": {
                          const isFullPaid = o.payment_status === "paid" || (Number(o.due_amount) <= 0 && Number(o.grand_total) > 0);
                          return (
                            <td
                              key="payment_status"
                              className={clsx(
                                TD,
                                "text-center",
                                isFullPaid && "bg-emerald-50/90 font-medium transition-colors"
                              )}
                            >
                              <div className="flex justify-center">
                                <button
                                  type="button"
                                  onClick={() => canEdit && setPaymentOrder(o)}
                                  title={canEdit ? "Click to record / update payment" : undefined}
                                  className={clsx(
                                    "group relative inline-flex items-center gap-1.5 transition-all text-center",
                                    canEdit && "cursor-pointer hover:opacity-90 active:scale-95"
                                  )}
                                >
                                  <StatusPill
                                    label={
                                      o.payment_status === "partial" && o.due_amount
                                        ? `Partial (Due: ${formatCurrency(o.due_amount, o.currency_code)})`
                                        : labelize(o.payment_status)
                                    }
                                    tone={PAYMENT_STATUS_TONE[o.payment_status]}
                                  />
                                  {canEdit && (
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-primary-600 underline font-semibold">
                                      Edit
                                    </span>
                                  )}
                                </button>
                              </div>
                            </td>
                          );
                        }
                        case "created_at":
                          return <td key="created_at" className={`${TD} text-center text-xs text-ink-muted whitespace-nowrap`}>{o.created_at ? formatDate(o.created_at) : "—"}</td>;
                        case "updated_at":
                          return <td key="updated_at" className={`${TD} text-center text-xs text-ink-muted whitespace-nowrap`}>{o.updated_at ? formatDate(o.updated_at) : "—"}</td>;
                        case "actions":
                          return (
                            <td key="actions" className={`${TD} text-right`}>
                              <div className="flex justify-end gap-1">
                                {!isClientUser && (
                                  <RowActionButton label="Send Notification (WhatsApp / Email)" onClick={() => setNotifyingOrder(o)}>
                                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                                  </RowActionButton>
                                )}
                                {canEdit && (
                                  <RowActionButton
                                    label="Record / Update Payment"
                                    onClick={() => setPaymentOrder(o)}
                                  >
                                    <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
                                  </RowActionButton>
                                )}
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
                                  <RowActionButton label={isClientUser ? "View Project Details" : "View / Edit"} onClick={() => {}}>
                                    {canEdit ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5 text-primary-600" />}
                                  </RowActionButton>
                                </Link>
                                {canDelete && (
                                  <RowActionButton label="Delete" tone="danger" onClick={() => setDeleting(o)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </RowActionButton>
                                )}
                              </div>
                            </td>
                          );
                        default:
                          return null;
                      }
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {orders.length > 0 && (
          <div className="border-t border-border bg-gradient-to-r from-surface-sunken/60 via-surface to-surface-sunken/60 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Left side: Project counts, search/selection indicator, and load-more trigger */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-ink">
                <Receipt className="h-3.5 w-3.5 text-primary-600" />
                <span>
                  {selected.size > 0
                    ? `Selected (${selected.size} of ${totalCount})`
                    : debouncedSearch
                    ? `Search: "${debouncedSearch}"`
                    : "Total Projects"}
                </span>
              </div>
              <span className="text-border">|</span>
              <span className="text-ink-muted text-[11.5px]">
                Showing <strong className="text-ink">{orders.length}</strong> of{" "}
                <strong className="text-ink">{totalCount}</strong>
              </span>

              {hasMore ? (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-1 rounded-md bg-white hover:bg-primary-50 text-primary-700 hover:text-primary-800 border border-primary-200 px-2.5 py-1 text-[11px] font-semibold transition-all shadow-2xs hover:shadow-xs active:scale-[0.98] disabled:opacity-60 cursor-pointer ml-1"
                >
                  {loadingMore ? (
                    <span>Loading...</span>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 text-primary-600" />
                      <span>Load More ({totalCount - orders.length})</span>
                    </>
                  )}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium ml-1">
                  <Check className="h-3 w-3 text-emerald-600" /> All loaded
                </span>
              )}
            </div>

            {/* Right side: Unified Converted Totals in Base Currency (with breakdown if multi-currency) */}
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap ml-auto">
              {/* Total Amount */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-ink-muted">Total:</span>
                <span className="font-bold text-ink font-mono text-[13px]">
                  {formatCurrency(effectiveTotals.grandTotal, effectiveTotals.baseCurrency)}
                </span>
                {effectiveTotals.hasForeign && (
                  <span className="text-[11px] text-ink-muted hidden sm:inline" title="Original Currency Breakdown">
                    ({effectiveTotals.breakdown.map((b) => formatCurrency(b.grandTotal, b.currency)).join(" + ")})
                  </span>
                )}
              </div>

              <div className="h-3.5 w-px bg-border hidden sm:block" />

              {/* Paid Amount */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-ink-muted">Paid:</span>
                <span className="font-bold text-emerald-700 font-mono text-[13px]">
                  {formatCurrency(effectiveTotals.paidAmount, effectiveTotals.baseCurrency)}
                </span>
                {effectiveTotals.hasForeign && effectiveTotals.paidAmount > 0 && (
                  <span className="text-[11px] text-ink-muted hidden sm:inline" title="Original Paid Breakdown">
                    ({effectiveTotals.breakdown.map((b) => formatCurrency(b.paidAmount, b.currency)).join(" + ")})
                  </span>
                )}
              </div>

              <div className="h-3.5 w-px bg-border hidden sm:block" />

              {/* Pending Balance Due */}
              <div
                className={clsx(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold shadow-2xs transition-all",
                  effectiveTotals.dueAmount > 0
                    ? "bg-rose-50 border-rose-200 text-rose-800 ring-1 ring-rose-400/20"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800 ring-1 ring-emerald-400/20"
                )}
              >
                <span className="text-[10px] uppercase font-bold text-ink-muted">Due:</span>
                <span
                  className={clsx(
                    "font-mono font-extrabold text-[13px]",
                    effectiveTotals.dueAmount > 0 ? "text-rose-700" : "text-emerald-700"
                  )}
                >
                  {formatCurrency(effectiveTotals.dueAmount, effectiveTotals.baseCurrency)}
                </span>
                {effectiveTotals.hasForeign && effectiveTotals.dueAmount > 0 && (
                  <span
                    className="text-[10.5px] text-rose-600/80 font-normal hidden sm:inline"
                    title="Original Due Breakdown"
                  >
                    ({effectiveTotals.breakdown.map((b) => formatCurrency(b.dueAmount, b.currency)).join(" + ")})
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
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

      {paymentOrder && (
        <QuickPaymentModal
          order={paymentOrder}
          onClose={() => setPaymentOrder(null)}
          onSuccess={handleOrderPaymentUpdated}
        />
      )}
    </div>
  );
}
