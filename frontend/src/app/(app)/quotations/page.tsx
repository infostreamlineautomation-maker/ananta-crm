"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Image as ImageIcon,
  Layers,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  ZoomIn,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { usePaginatedList, useList, useDebouncedValue } from "@/lib/hooks";
import { Client, Company, Country, QuotationDetail, QuotationSummary } from "@/lib/types";
import { formatCurrency, formatDate, mediaUrl } from "@/lib/format";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { SendNotificationModal } from "@/components/notifications/SendNotificationModal";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, RowActionButton } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill, QUOTATION_STATUS_TONE, labelize } from "@/components/ui/StatusPill";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";
import { ResizableTh } from "@/components/ui/ResizableTh";
import { useTableGrid } from "@/lib/useTableGrid";
import { FilterBar } from "@/components/ui/FilterBar";
import { ColumnHeaderFilter } from "@/components/ui/ColumnHeaderFilter";
import { DynamicFilterColumn, useDynamicColumnFilters } from "@/lib/useDynamicColumnFilters";
import { ExportColumn } from "@/lib/export-utils";

const QUOTATIONS_EXPORT_COLUMNS: ExportColumn<any>[] = [
  { header: "Quotation No", accessor: (q: any) => q.quotation_no, category: "Basic Info", defaultSelected: true },
  { header: "Quotation Date", accessor: (q: any) => q.quotation_date, category: "Basic Info", defaultSelected: true },
  { header: "Status", accessor: (q: any) => labelize(q.status), category: "Basic Info", defaultSelected: true },
  { header: "Client Name", accessor: (q: any) => q.client_name || "", category: "Recipient Info", defaultSelected: true },
  { header: "Company Name", accessor: (q: any) => q.company_name || "", category: "Recipient Info", defaultSelected: false },
  { header: "Recipient Name (To)", accessor: (q: any) => q.to_name || q.client_name || "", category: "Recipient Info", defaultSelected: false },
  { header: "Address", accessor: (q: any) => q.to_address || q.client_address || "", category: "Recipient Info", defaultSelected: false },
  { header: "Subject", accessor: (q: any) => q.subject || "", category: "Quotation Content", defaultSelected: true },
  { header: "Introductory Text", accessor: (q: any) => q.intro_text || "", category: "Quotation Content", defaultSelected: false },
  { header: "Terms & Conditions / Notes", accessor: (q: any) => q.notes || "", category: "Quotation Content", defaultSelected: false },
  { header: "Currency", accessor: (q: any) => q.currency_code || "INR", category: "Financials & Tax", defaultSelected: false },
  { header: "Subtotal / Amount", accessor: (q: any) => q.subtotal, category: "Financials & Tax", defaultSelected: false },
  { header: "Tax %", accessor: (q: any) => q.tax_percent ?? "0", category: "Financials & Tax", defaultSelected: false },
  { header: "Tax Amount", accessor: (q: any) => q.tax_amount || "0.00", category: "Financials & Tax", defaultSelected: false },
  { header: "Total Amount", accessor: (q: any) => q.total_amount || q.subtotal, category: "Financials & Tax", defaultSelected: true },
  {
    header: "Line Items Summary",
    accessor: (q: any) =>
      q.items?.map((it: any, idx: number) => `${idx + 1}. ${it.description} - Qty: ${it.qty} @ ${it.rate}`).join(" | ") || "",
    category: "Line Items & Images",
    defaultSelected: false,
  },
  {
    header: "Image Preview",
    accessor: (q: any) => {
      const count = q.items?.filter((it: any) => !!it.image)?.length || 0;
      return count > 0 ? `${count} Image${count > 1 ? "s" : ""}` : "-";
    },
    imageAccessor: (q: any) => {
      const firstItemWithImg = q.items?.find((it: any) => Boolean(it.image));
      return firstItemWithImg?.image ? mediaUrl(firstItemWithImg.image) : null;
    },
    category: "Line Items & Images",
    defaultSelected: true,
  },
  { header: "Created Date", accessor: (q: any) => q.created_at ? formatDate(q.created_at) : "", category: "System Dates", defaultSelected: false },
];

const QUOTATIONS_PAGE_COLUMNS: ColumnDef[] = [
  { key: "select", label: "Checkbox", required: true },
  { key: "quotation_no", label: "Quotation No", required: true },
  { key: "date", label: "Date" },
  { key: "client_name", label: "Client" },
  { key: "company_name", label: "Company", defaultVisible: false },
  { key: "to_name", label: "Recipient Name (To)", defaultVisible: false },
  { key: "to_address", label: "Address", defaultVisible: false },
  { key: "project_name", label: "Project Name", defaultVisible: false },
  { key: "subject", label: "Subject" },
  { key: "intro_text", label: "Introductory Text", defaultVisible: false },
  { key: "notes", label: "Terms & Conditions / Notes", defaultVisible: false },
  { key: "currency_code", label: "Currency", defaultVisible: false },
  { key: "status", label: "Status" },
  { key: "subtotal", label: "Total Amount" },
  { key: "created_at", label: "Created Date", defaultVisible: false },
  { key: "updated_at", label: "Updated Date", defaultVisible: false },
  { key: "actions", label: "Actions", required: true },
];

export default function QuotationsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const grid = useTableGrid({
    tableKey: "quotations",
    defaultColumns: QUOTATIONS_PAGE_COLUMNS,
    defaultVisibleKeys: [
      "select",
      "quotation_no",
      "date",
      "client_name",
      "subject",
      "status",
      "subtotal",
      "actions",
    ],
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState<QuotationSummary | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [activeLightboxImages, setActiveLightboxImages] = useState<{ id?: number; image: string; caption?: string }[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [notifyingQuotation, setNotifyingQuotation] = useState<QuotationSummary | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (!data?.results) return;
    if (expandedIds.size === data.results.length) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(data.results.map((q) => q.id)));
    }
  };

  async function handleCopyQuotation(quoteId: number) {
    setCopyingId(quoteId);
    try {
      const copy = await apiFetch<QuotationDetail>(`/api/quotations/${quoteId}/copy/`, {
        method: "POST",
      });
      toast.success(`Copied to ${copy.quotation_no}.`);
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't duplicate this quotation.");
    } finally {
      setCopyingId(null);
    }
  }

  const { items: countries } = useList<Country>("/api/countries/");

  const baseFilterColumns: DynamicFilterColumn[] = useMemo(
    () => [
      {
        key: "quotation_no",
        label: "Quotation No",
        type: "text",
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
        key: "country",
        label: "Country",
        type: "select",
        options: countries.map((c) => ({ value: c.code, label: c.name })),
      },
      {
        key: "subject",
        label: "Subject",
        type: "text",
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "draft", label: "Draft" },
          { value: "sent", label: "Sent" },
          { value: "accepted", label: "Accepted" },
          { value: "rejected", label: "Rejected" },
          { value: "expired", label: "Expired" },
        ],
      },
      {
        key: "amount",
        label: "Total Amount",
        type: "amount_range",
      },
    ],
    [countries]
  );

  const {
    columns: filterColumns,
    activeFilters,
    setFilter,
    resetFilters,
    appendQueryParams,
  } = useDynamicColumnFilters({
    module: "quotation_item",
    baseColumns: baseFilterColumns,
  });

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    appendQueryParams(params);
    params.set("page", String(page));
    return `/api/quotations/?${params.toString()}`;
  }, [debouncedSearch, appendQueryParams, page]);

  const { data, loading, reload } = usePaginatedList<QuotationSummary>(path);

  const canAdd = can("quotations", "add");
  const canEdit = can("quotations", "edit");
  const canDelete = can("quotations", "delete");

  const getColFilter = (key: string) => filterColumns.find((c) => c.key === key);

  const toggleSelectAll = () => {
    if (!data?.results) return;
    if (selected.size === data.results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.results.map((q) => q.id)));
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
    if (!confirm(`Are you sure you want to delete ${selected.size} quotations?`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all(
        Array.from(selected).map((id) => apiFetch(`/api/quotations/${id}/`, { method: "DELETE" }))
      );
      toast.success(`Deleted ${selected.size} quotations.`);
      setSelected(new Set());
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't delete some quotations.");
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {selected.size > 0 ? (
        <div className="flex items-center justify-between rounded-md border border-primary-100 bg-primary-50 px-4 py-2.5">
          <span className="text-[13.5px] font-semibold text-primary-700">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <ExportDropdown
              data={data?.results || []}
              selectedIds={selected}
              filename="quotations_export"
              title="Quotations Report"
              columns={QUOTATIONS_EXPORT_COLUMNS}
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
          searchPlaceholder="Search quotation no, client, subject..."
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
                filename="quotations_export"
                title="Quotations Report"
                columns={QUOTATIONS_EXPORT_COLUMNS}
              />
              <ColumnSelector
                columns={grid.columns}
                visibleColumns={grid.visibleColumns}
                onChange={grid.setVisibleColumns}
                onReorder={grid.reorderColumns}
                onReset={grid.resetGrid}
              />
              {canAdd && (
                <Link href="/quotations/new">
                  <Button variant="primary">
                    <Plus className="h-4 w-4" /> New Quotation
                  </Button>
                </Link>
              )}
            </div>
          }
        />
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken/40 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                <th className="w-8 px-2 py-2.5 text-center">
                  <button
                    type="button"
                    onClick={toggleExpandAll}
                    title={expandedIds.size === (data?.results?.length || 0) ? "Collapse All" : "Expand All"}
                    className="flex h-6 w-6 items-center justify-center rounded text-ink-muted hover:bg-surface-hover hover:text-ink cursor-pointer transition-colors mx-auto"
                  >
                    {expandedIds.size > 0 && expandedIds.size === (data?.results?.length || 0) ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                </th>
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
                            checked={Boolean(data?.results?.length && selected.size === data.results.length)}
                            onChange={toggleSelectAll}
                            className="h-3.5 w-3.5 rounded border-border-strong text-primary-500 focus:ring-primary-500/20"
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

                    const isRight = ["subtotal"].includes(col.key);
                    const colFilter = getColFilter(col.key === "subtotal" ? "amount" : col.key);

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
                                setPage(1);
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
                empty={!loading && (data?.results.length ?? 0) === 0}
                colSpan={grid.visibleColumns.size + 1}
                emptyLabel="No quotations yet."
              />
              {data?.results.map((q) => {
                const isExpanded = expandedIds.has(q.id);
                const itemCount = q.items?.length || 0;
                return (
                  <Fragment key={q.id}>
                    <tr className={`${TR} hover:bg-surface-hover transition-colors ${isExpanded ? "bg-surface-hover/40" : ""}`}>
                      <td className="w-8 px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggleExpand(q.id)}
                          className="flex h-6 w-6 items-center justify-center rounded text-ink-muted hover:bg-surface-hover hover:text-ink cursor-pointer transition-colors mx-auto"
                          title={isExpanded ? "Collapse inline items" : "Expand inline items"}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-primary-600" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      {grid.columns
                        .filter((col) => grid.visibleColumns.has(col.key))
                        .map((col) => {
                          switch (col.key) {
                            case "select":
                              return (
                                <td key="select" className="w-10 px-3 py-2.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selected.has(q.id)}
                                    onChange={() => toggleSelectOne(q.id)}
                                    className="h-3.5 w-3.5 rounded border-border-strong text-primary-500 focus:ring-primary-500/20"
                                  />
                                </td>
                              );
                            case "quotation_no":
                              return (
                                <td key="quotation_no" className={TD}>
                                  <div className="flex items-center gap-2">
                                    <Link href={`/quotations/${q.id}`} className="font-mono text-[13px] font-semibold text-ink hover:text-primary-500">
                                      {q.quotation_no}
                                    </Link>
                                    {itemCount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => toggleExpand(q.id)}
                                        className="inline-flex items-center gap-1 rounded-full bg-primary-50 dark:bg-primary-950/50 border border-primary-200 dark:border-primary-800/60 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700 dark:text-primary-300 hover:bg-primary-100 transition-colors cursor-pointer"
                                        title="Toggle inline items"
                                      >
                                        <Layers className="h-2.5 w-2.5" />
                                        {itemCount}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              );
                            case "date":
                              return <td key="date" className={`${TD} text-ink-muted`}>{formatDate(q.quotation_date)}</td>;
                            case "client_name":
                              return (
                                <td key="client_name" className={TD}>
                                  {q.client_name ? (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-ink">{q.client_name}</span>
                                      {!grid.visibleColumns.has("company_name") && q.company_name && (
                                        <span className="text-[12px] font-medium text-ink-muted">
                                          ({q.company_name})
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-ink-muted">—</span>
                                  )}
                                </td>
                              );
                            case "company_name":
                              return <td key="company_name" className={`${TD} text-ink-muted`}>{q.company_name || "—"}</td>;
                            case "to_name":
                              return <td key="to_name" className={`${TD} text-ink-muted`}>{q.to_name || "—"}</td>;
                            case "to_address":
                              return <td key="to_address" className={`${TD} max-w-[200px] truncate text-ink-muted`} title={q.to_address || ""}>{q.to_address || "—"}</td>;
                            case "project_name":
                              return <td key="project_name" className={`${TD} text-ink-muted`}>{q.project_name || "—"}</td>;
                            case "subject":
                              return <td key="subject" className={`${TD} max-w-[200px] truncate text-ink-muted`} title={q.subject || ""}>{q.subject || "—"}</td>;
                            case "intro_text":
                              return <td key="intro_text" className={`${TD} max-w-[180px] truncate text-ink-muted`} title={q.intro_text || ""}>{q.intro_text || "—"}</td>;
                            case "notes":
                              return <td key="notes" className={`${TD} max-w-[180px] truncate text-ink-muted`} title={q.notes || ""}>{q.notes || "—"}</td>;
                            case "currency_code":
                              return <td key="currency_code" className={`${TD} font-mono text-xs text-ink-muted`}>{q.currency_code || "INR"}</td>;
                            case "status":
                              return (
                                <td key="status" className={TD}>
                                  <StatusPill label={labelize(q.status)} tone={QUOTATION_STATUS_TONE[q.status]} />
                                </td>
                              );
                            case "subtotal":
                              return <td key="subtotal" className={`${TD} tnum text-right font-semibold text-ink`}>{formatCurrency(q.subtotal, q.currency_code)}</td>;
                            case "created_at":
                              return <td key="created_at" className={`${TD} text-xs text-ink-muted`}>{q.created_at ? formatDate(q.created_at) : "—"}</td>;
                            case "updated_at":
                              return <td key="updated_at" className={`${TD} text-xs text-ink-muted`}>{q.updated_at ? formatDate(q.updated_at) : "—"}</td>;
                            case "actions":
                              return (
                                <td key="actions" className={`${TD} text-right`}>
                                  <div className="flex justify-end gap-1">
                                    <RowActionButton label="Send Notification (WhatsApp / Email)" onClick={() => setNotifyingQuotation(q)}>
                                      <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                                    </RowActionButton>
                                    <Link href={`/quotations/${q.id}/print`} target="_blank">
                                      <RowActionButton label="Print / Save PDF" onClick={() => {}}>
                                        <Printer className="h-3.5 w-3.5 text-primary-600" />
                                      </RowActionButton>
                                    </Link>
                                    {canAdd && (
                                      <RowActionButton
                                        label="Duplicate / Copy Quotation"
                                        onClick={() => handleCopyQuotation(q.id)}
                                        disabled={copyingId === q.id}
                                      >
                                        {copyingId === q.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-500" />
                                        ) : (
                                          <Copy className="h-3.5 w-3.5 text-primary-600 hover:text-primary-700" />
                                        )}
                                      </RowActionButton>
                                    )}
                                    {canEdit && (
                                      <Link href={`/quotations/${q.id}`}>
                                        <RowActionButton label="Edit" onClick={() => {}}>
                                          <Pencil className="h-3.5 w-3.5" />
                                        </RowActionButton>
                                      </Link>
                                    )}
                                    {canDelete && (
                                      <RowActionButton label="Delete" tone="danger" onClick={() => setDeleting(q)}>
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

                    {/* Inline Info Expandable Dropdown Row */}
                    {isExpanded && (
                      <tr className="bg-surface-sunken/40">
                        <td colSpan={grid.visibleColumns.size + 1} className="p-0 border-b border-border/80">
                          <div className="px-6 py-4 bg-gradient-to-b from-surface-sunken/30 to-surface border-l-4 border-l-primary-500 shadow-inner">
                            <div className="flex items-center justify-between pb-2 mb-3 border-b border-border/60">
                              <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-primary-600" />
                                <span className="text-xs font-bold uppercase tracking-wider text-ink">
                                  Inline Quotation Items &amp; Specifications
                                </span>
                                <span className="rounded-full bg-primary-100 dark:bg-primary-950/60 px-2 py-0.5 text-[11px] font-semibold text-primary-700 dark:text-primary-300">
                                  {itemCount} item{itemCount !== 1 ? "s" : ""}
                                </span>
                              </div>
                              <div className="text-xs text-ink-muted">
                                Quotation: <span className="font-semibold font-mono text-ink">{q.quotation_no}</span>
                              </div>
                            </div>

                            {!q.items || q.items.length === 0 ? (
                              <div className="py-4 text-center text-xs text-ink-muted italic">
                                No line items added to this quotation.
                              </div>
                            ) : (
                              (() => {
                                const hasAnyItemImage = q.items.some((it) => Boolean(it.image));
                                return (
                                  <div className="overflow-x-auto rounded-md border border-border/80 bg-surface shadow-2xs">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="border-b border-border bg-surface-sunken/70 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                                          <th className="w-10 px-3 py-2 text-center">#</th>
                                          <th className="px-3 py-2">Description / Specifications</th>
                                          {q.columns_config?.map((col) => (
                                            <th key={col.key} className="px-3 py-2">
                                              {col.label}
                                            </th>
                                          ))}
                                          <th className="w-24 px-3 py-2 text-right">{q.col_qty_label || "Qty"}</th>
                                          <th className="w-28 px-3 py-2 text-right">{q.col_rate_label || "Rate"}</th>
                                          <th className="w-32 px-3 py-2 text-right">Amount</th>
                                          {hasAnyItemImage && (
                                            <th className="w-20 px-3 py-2 text-center">Reference</th>
                                          )}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border/50">
                                        {q.items.map((item, idx) => {
                                          const itemAmt = Number(item.qty || 0) * Number(item.rate || 0);
                                          const imgUrl = item.image ? mediaUrl(item.image) : null;
                                          return (
                                            <tr key={item.id || idx} className="hover:bg-surface-hover/60 transition-colors">
                                              <td className="px-3 py-2.5 text-center font-mono font-medium text-ink-muted">
                                                {idx + 1}
                                              </td>
                                              <td className="px-3 py-2.5">
                                                <div className="font-medium text-ink whitespace-pre-line leading-relaxed">
                                                  {item.description || "—"}
                                                </div>
                                              </td>
                                              {q.columns_config?.map((col) => (
                                                <td key={col.key} className="px-3 py-2.5 text-ink-muted">
                                                  {item.extra_data?.[col.key] || item.extra_data?.[col.label] || "—"}
                                                </td>
                                              ))}
                                              <td className="px-3 py-2.5 text-right font-medium text-ink tnum">
                                                {item.qty || "0"}
                                              </td>
                                              <td className="px-3 py-2.5 text-right font-medium text-ink tnum">
                                                {formatCurrency(item.rate, q.currency_code)}
                                              </td>
                                              <td className="px-3 py-2.5 text-right font-semibold text-ink tnum">
                                                {formatCurrency(item.amount || itemAmt, q.currency_code)}
                                              </td>
                                              {hasAnyItemImage && (
                                                <td className="px-3 py-2.5 text-center align-middle">
                                                  {imgUrl ? (
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        const allQuoteImages = (q.items || [])
                                                          .filter((it) => it.image)
                                                          .map((it) => ({
                                                            image: mediaUrl(it.image) || "",
                                                            caption: it.description || `Item #${(q.items?.indexOf(it) ?? 0) + 1}`,
                                                          }));
                                                        const currentIdx = allQuoteImages.findIndex((img) => img.image === imgUrl);
                                                        setActiveLightboxImages(allQuoteImages);
                                                        setLightboxIndex(Math.max(0, currentIdx));
                                                      }}
                                                      className="group relative inline-block h-12 w-12 overflow-hidden rounded-md border border-border bg-white shadow-2xs hover:border-primary-400 cursor-pointer transition-all p-0.5"
                                                      title="Click to zoom image"
                                                    >
                                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                                      <img
                                                        src={imgUrl}
                                                        alt="Item proof"
                                                        className="h-full w-full object-cover rounded group-hover:scale-110 transition-transform duration-200"
                                                      />
                                                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <ZoomIn className="h-3.5 w-3.5 text-white" />
                                                      </div>
                                                    </button>
                                                  ) : (
                                                    <span className="text-ink-muted text-sm font-medium">—</span>
                                                  )}
                                                </td>
                                              )}
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                );
                              })()
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {data && <Pagination count={data.count} page={page} onPageChange={setPage} />}
      </Card>

      {activeLightboxImages && activeLightboxImages.length > 0 && (
        <ImageLightboxModal
          open={Boolean(activeLightboxImages)}
          onClose={() => setActiveLightboxImages(null)}
          images={activeLightboxImages}
          initialIndex={lightboxIndex}
        />
      )}

      {notifyingQuotation && (
        <SendNotificationModal
          open
          onClose={() => setNotifyingQuotation(null)}
          target={{
            type: "quotation",
            id: notifyingQuotation.id,
            title: `Quotation ${notifyingQuotation.quotation_no}`,
            clientName: notifyingQuotation.client_name || "Client",
            quotationNo: notifyingQuotation.quotation_no,
            amount: notifyingQuotation.subtotal,
            currency: notifyingQuotation.currency_code || "INR",
            date: notifyingQuotation.quotation_date,
            status: notifyingQuotation.status,
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          open
          onClose={() => setDeleting(null)}
          title="Delete quotation"
          description={`Delete "${deleting.quotation_no}"? This can be undone later from the archive.`}
          onConfirm={async () => {
            try {
              await apiFetch(`/api/quotations/${deleting.id}/`, { method: "DELETE" });
              toast.success("Quotation deleted.");
              setDeleting(null);
              reload();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Couldn't delete this quotation.");
            }
          }}
        />
      )}
    </div>
  );
}
