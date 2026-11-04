"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Download, Eye, Layers, MessageSquare, Pencil, Plus, Printer, Receipt, Search, Trash2, Image as ImageIcon } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/organization-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useInfinitePaginatedList, useList, useDebouncedValue } from "@/lib/hooks";
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
import { LoadMorePagination } from "@/components/ui/Pagination";
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const grid = useTableGrid({
    tableKey: "orders",
    defaultColumns: ORDERS_COLUMNS,
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
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (selectedGroup !== "all") params.set("client_group", String(selectedGroup));
    appendQueryParams(params);
    return `/api/orders/?${params.toString()}`;
  }, [debouncedSearch, selectedGroup, appendQueryParams]);

  const {
    items: orders,
    count: totalCount,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    reload,
    extra,
  } = useInfinitePaginatedList<OrderSummary>(basePath);

  const { activeOrganization } = useOrganization();
  const displayCurrency = orders[0]?.currency_code || activeOrganization?.default_currency_code || "INR";

  const localTotals = useMemo(() => {
    let grandTotal = 0;
    let paidAmount = 0;
    let dueAmount = 0;
    for (const o of orders) {
      grandTotal += Number(o.grand_total || 0);
      paidAmount += Number(o.paid_amount || 0);
      dueAmount += Number(o.due_amount || 0);
    }
    return { grandTotal, paidAmount, dueAmount };
  }, [orders]);

  const totalGrand = extra?.total_grand_total !== undefined ? Number(extra.total_grand_total) : localTotals.grandTotal;
  const totalPaid = extra?.total_paid_amount !== undefined ? Number(extra.total_paid_amount) : localTotals.paidAmount;
  const totalDue = extra?.total_due_amount !== undefined ? Number(extra.total_due_amount) : localTotals.dueAmount;

  const selectedTotals = useMemo(() => {
    if (selected.size === 0) return null;
    let grandTotal = 0;
    let paidAmount = 0;
    let dueAmount = 0;
    for (const o of orders) {
      if (selected.has(o.id)) {
        grandTotal += Number(o.grand_total || 0);
        paidAmount += Number(o.paid_amount || 0);
        dueAmount += Number(o.due_amount || 0);
      }
    }
    return { grandTotal, paidAmount, dueAmount };
  }, [orders, selected]);

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
          searchPlaceholder="Search project no, description..."
          filters={filterColumns}
          activeFilters={activeFilters}
          onFilterChange={(k, v) => {
            setFilter(k, v);
          }}
          onReset={() => {
            resetFilters();
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
                    const colFilter = getColFilter(col.key) || (col.key === "grand_total" ? getColFilter("amount") : undefined) || (col.key === "amount" ? getColFilter("grand_total") : undefined);

                    return (
                      <ResizableTh
                        key={col.key}
                        columnKey={col.key}
                        grid={grid}
                        align={isRight ? "right" : "left"}
                      >
                        <div className={clsx("inline-flex items-center", isRight && "justify-end")}>
                          <span>{col.label}</span>
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
                            <td key="select" className="px-4 py-3">
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
                          return <td key="date" className={`${TD} text-ink-muted`}>{formatDate(o.date)}</td>;
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
                          return <td key="delivery_time" className={`${TD} text-ink-muted max-w-[160px] truncate`} title={o.delivery_time || ""}>{o.delivery_time || "—"}</td>;
                        case "description":
                          return <td key="description" className={`${TD} text-ink-muted max-w-[180px] truncate`} title={o.description || ""}>{o.description || "—"}</td>;
                        case "currency_code":
                          return <td key="currency_code" className={`${TD} font-mono text-xs text-ink-muted`}>{o.currency_code || "INR"}</td>;
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
                            <td key="delivery_status" className={TD}>
                              <StatusPill label={labelize(o.delivery_status)} tone={DELIVERY_STATUS_TONE[o.delivery_status]} />
                            </td>
                          );
                        case "payment_status": {
                          const isFullPaid = o.payment_status === "paid" || (Number(o.due_amount) <= 0 && Number(o.grand_total) > 0);
                          return (
                            <td
                              key="payment_status"
                              className={clsx(
                                TD,
                                isFullPaid && "bg-emerald-50/90 font-medium transition-colors"
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
                            </td>
                          );
                        }
                        case "created_at":
                          return <td key="created_at" className={`${TD} text-xs text-ink-muted`}>{o.created_at ? formatDate(o.created_at) : "—"}</td>;
                        case "updated_at":
                          return <td key="updated_at" className={`${TD} text-xs text-ink-muted`}>{o.updated_at ? formatDate(o.updated_at) : "—"}</td>;
                        case "actions":
                          return (
                            <td key="actions" className={`${TD} text-right`}>
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
                          );
                        default:
                          return null;
                      }
                    })}
                  </tr>
                );
              })}
            </tbody>
            {orders.length > 0 && (
              <tfoot className="border-t-2 border-border-strong bg-surface-sunken/80">
                <tr className="font-semibold text-xs text-ink divide-x divide-border/40">
                  {grid.columns
                    .filter((col) => grid.visibleColumns.has(col.key))
                    .map((col) => {
                      if (col.key === "select") {
                        return <td key="select" className="px-3 py-3 text-center text-ink-muted">—</td>;
                      }
                      if (col.key === "order_no") {
                        return (
                          <td key="order_no" className="px-3 py-3 font-bold uppercase tracking-wider text-[11px] text-ink whitespace-nowrap">
                            TOTAL ({selected.size > 0 ? `${selected.size} sel` : totalCount})
                          </td>
                        );
                      }
                      if (col.key === "grand_total") {
                        const val = selectedTotals ? selectedTotals.grandTotal : totalGrand;
                        return (
                          <td key="grand_total" className="px-3 py-3 text-right font-bold text-ink tnum whitespace-nowrap">
                            {formatCurrency(val, displayCurrency)}
                          </td>
                        );
                      }
                      if (col.key === "paid_amount") {
                        const val = selectedTotals ? selectedTotals.paidAmount : totalPaid;
                        return (
                          <td key="paid_amount" className="px-3 py-3 text-right font-bold text-emerald-700 tnum whitespace-nowrap">
                            {formatCurrency(val, displayCurrency)}
                          </td>
                        );
                      }
                      if (col.key === "due_amount") {
                        const val = selectedTotals ? selectedTotals.dueAmount : totalDue;
                        return (
                          <td
                            key="due_amount"
                            className={clsx(
                              "px-3 py-3 text-right font-extrabold tnum whitespace-nowrap text-sm",
                              val > 0 ? "text-rose-600 bg-rose-50/70" : "text-emerald-700 bg-emerald-50/70"
                            )}
                          >
                            {formatCurrency(val, displayCurrency)}
                          </td>
                        );
                      }
                      if (col.key === "payment_status") {
                        const val = selectedTotals ? selectedTotals.dueAmount : totalDue;
                        return (
                          <td key="payment_status" className="px-3 py-3 text-center whitespace-nowrap">
                            {val > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
                                Pending Due
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                                All Cleared
                              </span>
                            )}
                          </td>
                        );
                      }
                      return <td key={col.key} className="px-3 py-3 text-ink-muted text-xs text-center">—</td>;
                    })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {orders.length > 0 && (
          <div className="border-t border-border bg-gradient-to-r from-surface-sunken/40 via-surface to-surface-sunken/40 px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 border border-primary-200 text-primary-700 shadow-2xs">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink">
                    {selected.size > 0
                      ? `Selected Projects Summary (${selected.size} of ${totalCount})`
                      : debouncedSearch
                      ? `Client / Search Summary: "${debouncedSearch}"`
                      : "Total Projects Summary"}
                  </p>
                  {debouncedSearch && !selected.size && (
                    <span className="text-[10px] font-semibold bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">
                      Search Filter Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-muted">
                  {selected.size > 0
                    ? `Showing totals for ${selected.size} selected project(s)`
                    : `Showing totals across all ${totalCount} matching project(s)`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-6">
              <div className="flex flex-col sm:items-end">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Total Amount</span>
                <span className="text-sm sm:text-base font-bold text-ink tnum">
                  {formatCurrency(selectedTotals ? selectedTotals.grandTotal : totalGrand, displayCurrency)}
                </span>
              </div>

              <div className="h-8 w-px bg-border hidden sm:block" />

              <div className="flex flex-col sm:items-end">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Paid Amount</span>
                <span className="text-sm sm:text-base font-bold text-emerald-600 tnum">
                  {formatCurrency(selectedTotals ? selectedTotals.paidAmount : totalPaid, displayCurrency)}
                </span>
              </div>

              <div className="h-8 w-px bg-border hidden sm:block" />

              <div
                className={clsx(
                  "flex items-center gap-3 rounded-xl border px-4 py-2 shadow-2xs transition-all",
                  (selectedTotals ? selectedTotals.dueAmount : totalDue) > 0
                    ? "bg-rose-50 border-rose-300 ring-2 ring-rose-500/10 text-rose-950"
                    : "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/10 text-emerald-950"
                )}
              >
                <div className="flex flex-col sm:items-end">
                  <span
                    className={clsx(
                      "text-[11px] font-extrabold uppercase tracking-wider",
                      (selectedTotals ? selectedTotals.dueAmount : totalDue) > 0 ? "text-rose-700" : "text-emerald-700"
                    )}
                  >
                    Total Pending Bill Amount (Balance Due)
                  </span>
                  <span
                    className={clsx(
                      "text-lg sm:text-xl font-black tnum",
                      (selectedTotals ? selectedTotals.dueAmount : totalDue) > 0 ? "text-rose-600" : "text-emerald-600"
                    )}
                  >
                    {formatCurrency(selectedTotals ? selectedTotals.dueAmount : totalDue, displayCurrency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <LoadMorePagination
          loadedCount={orders.length}
          totalCount={totalCount}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          itemName="projects"
        />
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
