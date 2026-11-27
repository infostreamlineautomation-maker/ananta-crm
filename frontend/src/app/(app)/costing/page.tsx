"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Copy, Eye, Layers, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/organization-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useDebouncedValue, useInfinitePaginatedList, useList } from "@/lib/hooks";
import { Client, ClientGroup, CostingDetail } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { ExportColumn } from "@/lib/export-utils";
import { ClientGroupModal } from "@/components/clients/ClientGroupModal";
import { useToast } from "@/components/ui/Toast";
import { RowActionButton } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TD, TR, TableState } from "@/components/ui/Table";
import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";
import { FilterBar } from "@/components/ui/FilterBar";
import { ColumnHeaderFilter, SortButton } from "@/components/ui/ColumnHeaderFilter";
import { DynamicFilterColumn, useDynamicColumnFilters } from "@/lib/useDynamicColumnFilters";
import { usePersistentState } from "@/lib/usePersistentState";
import { CostingViewModal } from "./CostingViewModal";
import { AttachmentDropdown } from "@/components/ui/AttachmentDropdown";
import { useTableGrid } from "@/lib/useTableGrid";
import { ResizableTh } from "@/components/ui/ResizableTh";

const COSTING_PAGE_COLUMNS: ColumnDef[] = [
  { key: "select", label: "Select", required: true },
  { key: "date", label: "Date", required: true },
  { key: "client", label: "Client" },
  { key: "company_name", label: "Company", defaultVisible: false },
  { key: "project_name", label: "Project Name", defaultVisible: false },
  { key: "file", label: "Attachment" },
  { key: "supplier", label: "Supplier" },
  { key: "product", label: "Product" },
  { key: "supplier_rate", label: "Supplier Rate" },
  { key: "quantity", label: "Qty" },
  { key: "client_rate", label: "Client Rate" },
  { key: "supplier_cost", label: "Supplier Total Cost", defaultVisible: false },
  { key: "client_revenue", label: "Client Total Revenue", defaultVisible: false },
  { key: "profit", label: "Profit" },
  { key: "profit_percent", label: "Profit %" },
  { key: "description", label: "Remarks / Notes", defaultVisible: false },
  { key: "created_at", label: "Created Date", defaultVisible: false },
  { key: "updated_at", label: "Updated Date", defaultVisible: false },
  { key: "actions", label: "Actions", required: true },
];

export default function CostingPage() {
  const { can } = useAuth();
  const toast = useToast();
  const { activeOrganization } = useOrganization();
  const [search, setSearch] = usePersistentState("crm_filter_search_costing", "");
  const debouncedSearch = useDebouncedValue(search);
  const [viewingCosting, setViewingCosting] = useState<CostingDetail | null>(null);
  const [deleting, setDeleting] = useState<CostingDetail | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(0);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const updateWidth = () => {
      if (el.clientWidth > 0) setViewportWidth(el.clientWidth);
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const { items: clientGroups, reload: reloadGroups } = useList<ClientGroup>("/api/client-groups/");
  const { items: allClients, reload: reloadClients } = useList<Client>("/api/clients/?page_size=300");
  const [selectedClient, setSelectedClient] = usePersistentState<Client | null>(
    "crm_filter_client_costing",
    null
  );
  const [selectedGroup, setSelectedGroup] = usePersistentState<number | "all">(
    "crm_filter_group_costing",
    "all"
  );
  const [groupModalOpen, setGroupModalOpen] = useState(false);

  const baseFilterColumns: DynamicFilterColumn[] = useMemo(
    () => [
      {
        key: "date",
        label: "Date",
        type: "date_range",
      },
      {
        key: "client",
        label: "Client",
        type: "text",
      },
      {
        key: "company_name",
        label: "Company",
        type: "text",
      },
      {
        key: "supplier",
        label: "Supplier",
        type: "text",
      },
      {
        key: "product",
        label: "Product",
        type: "text",
      },
      {
        key: "supplier_rate",
        label: "Supplier Rate",
        type: "amount_range",
      },
      {
        key: "quantity",
        label: "Qty",
        type: "amount_range",
      },
      {
        key: "client_rate",
        label: "Client Rate",
        type: "amount_range",
      },
      {
        key: "profit",
        label: "Profit",
        type: "amount_range",
      },
      {
        key: "profit_percent",
        label: "Profit %",
        type: "amount_range",
      },
      {
        key: "supplier_cost",
        label: "Supplier Total Cost",
        type: "amount_range",
      },
      {
        key: "client_revenue",
        label: "Client Total Revenue",
        type: "amount_range",
      },
      {
        key: "project_name",
        label: "Project Name",
        type: "text",
      },
      {
        key: "file",
        label: "Attachment",
        type: "text",
      },
      {
        key: "description",
        label: "Remarks / Notes",
        type: "text",
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
    customFields,
    activeFilters,
    setOrdering,
    toggleOrdering,
    getOrderingFor,
    setFilter,
    resetFilters,
    appendQueryParams,
  } = useDynamicColumnFilters({
    module: "costing_item",
    baseColumns: baseFilterColumns,
    initialOrdering: "-date",
  });

  const allColumns: ColumnDef[] = useMemo(() => {
    const base = [...COSTING_PAGE_COLUMNS];
    const actionCol = base.pop()!;
    const baseKeys = new Set(base.map((c) => c.key.toLowerCase().trim()));
    const baseLabels = new Set(base.map((c) => c.label.toLowerCase().trim()));

    const dynamicCols: ColumnDef[] = (customFields || [])
      .filter((f) => {
        const key = f.field_key.toLowerCase().trim();
        const label = f.label.toLowerCase().trim();
        if (baseKeys.has(key) || baseKeys.has(`extra_${key}`)) return false;
        if (baseLabels.has(label)) return false;
        return true;
      })
      .map((f) => ({
        key: `extra_${f.field_key}`,
        label: f.label,
        defaultVisible: f.show_in_table ?? false,
      }));
    return [...base, ...dynamicCols, actionCol];
  }, [customFields]);

  const grid = useTableGrid({
    tableKey: "costing",
    defaultColumns: allColumns,
    defaultVisibleKeys: [
      "select",
      "date",
      "client",
      "file",
      "supplier",
      "product",
      "supplier_rate",
      "quantity",
      "client_rate",
      "profit",
      "profit_percent",
      "actions",
    ],
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
    return `/api/costings/?${params.toString()}`;
  }, [selectedClient, debouncedSearch, selectedGroup, appendQueryParams]);

  const {
    items: costings,
    count: totalCount,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    reload,
    extra,
  } = useInfinitePaginatedList<CostingDetail>(basePath);

  const canAdd = can("costing", "add");
  const canEdit = can("costing", "edit");
  const canDelete = can("costing", "delete");

  const baseCurrency = extra?.costing_totals?.base_currency || activeOrganization?.default_currency_code || "INR";

  const effectiveTotals = useMemo(() => {
    if (selected.size > 0) {
      let supplierCost = 0;
      let clientRevenue = 0;
      for (const c of costings) {
        if (selected.has(c.id)) {
          supplierCost += Number(c.supplier_cost || 0);
          clientRevenue += Number(c.client_revenue || 0);
        }
      }
      const profit = clientRevenue - supplierCost;
      const profitPercent = supplierCost > 0 ? (profit / supplierCost) * 100 : 0;
      return {
        baseCurrency,
        supplierCost,
        clientRevenue,
        profit,
        profitPercent,
      };
    }

    if (extra?.costing_totals) {
      const supplierCost = Number(extra.costing_totals.supplier_cost || 0);
      const clientRevenue = Number(extra.costing_totals.client_revenue || 0);
      const profit = Number(extra.costing_totals.profit || 0);
      const profitPercent = Number(extra.costing_totals.profit_percent || 0);
      return {
        baseCurrency: extra.costing_totals.base_currency || baseCurrency,
        supplierCost,
        clientRevenue,
        profit,
        profitPercent,
      };
    }

    let supplierCost = 0;
    let clientRevenue = 0;
    for (const c of costings) {
      supplierCost += Number(c.supplier_cost || 0);
      clientRevenue += Number(c.client_revenue || 0);
    }
    const profit = clientRevenue - supplierCost;
    const profitPercent = supplierCost > 0 ? (profit / supplierCost) * 100 : 0;
    return {
      baseCurrency,
      supplierCost,
      clientRevenue,
      profit,
      profitPercent,
    };
  }, [costings, selected, extra, baseCurrency]);

  async function handleCopyCosting(costingId: number) {
    setCopyingId(costingId);
    try {
      await apiFetch<CostingDetail>(`/api/costings/${costingId}/copy/`, {
        method: "POST",
        body: JSON.stringify({ costing_date: new Date().toISOString().slice(0, 10) }),
      });
      toast.success("Costing sheet duplicated.");
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't duplicate this costing sheet.");
    } finally {
      setCopyingId(null);
    }
  }

  const toggleSelectAll = () => {
    if (selected.size === costings.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(costings.map((c) => c.id)));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (expandedIds.size === costings.length) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(costings.map((c) => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      await Promise.all(
        Array.from(selected).map((id) => apiFetch(`/api/costings/${id}/`, { method: "DELETE" }))
      );
      toast.success(`${selected.size} costing sheet(s) deleted successfully`);
      setSelected(new Set());
      setBulkDeleteConfirmOpen(false);
      reload();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete selected costings");
    } finally {
      setBulkDeleting(false);
    }
  };

  const costingExportColumns: ExportColumn<CostingDetail>[] = useMemo(
    () => [
      { key: "costing_date", header: "Costing Date", accessor: (c) => c.costing_date, category: "Basic Information", defaultSelected: true },
      { key: "client_display", header: "Client Name", accessor: (c) => c.client_display || "", category: "Basic Information", defaultSelected: true },
      { key: "company_name", header: "Company Name", accessor: (c) => c.company_name || "", category: "Basic Information", defaultSelected: true },
      { key: "supplier_display", header: "Supplier Name", accessor: (c) => c.supplier_display || "", category: "Basic Information", defaultSelected: true },
      { key: "product_display", header: "Product Name", accessor: (c) => c.product_names || c.product_display || "", category: "Basic Information", defaultSelected: true },
      { key: "supplier_rate", header: "Supplier Unit Rate", accessor: (c) => c.items?.[0]?.supplier_rate || "0", category: "Rates & Quantities", defaultSelected: true },
      {
        key: "quantity",
        header: "Quantity",
        accessor: (c) =>
          c.items && c.items.length > 0
            ? c.items.reduce((acc, it) => acc + Number(it.quantity || 0), 0)
            : "1",
        category: "Rates & Quantities",
        defaultSelected: true,
      },
      { key: "client_rate", header: "Client Unit Rate", accessor: (c) => c.items?.[0]?.client_rate || "0", category: "Rates & Quantities", defaultSelected: true },
      { key: "supplier_cost", header: "Supplier Total Cost", accessor: (c) => c.supplier_cost, category: "Financials & Margins", defaultSelected: true },
      { key: "client_revenue", header: "Client Total Revenue", accessor: (c) => c.client_revenue, category: "Financials & Margins", defaultSelected: true },
      { key: "profit", header: "Total Profit", accessor: (c) => c.profit, category: "Financials & Margins", defaultSelected: true },
      { key: "profit_percent", header: "Profit Percentage (%)", accessor: (c) => `${parseFloat(c.profit_percent || "0").toFixed(1)}%`, category: "Financials & Margins", defaultSelected: true },
      {
        key: "files",
        header: "Attached Documents",
        accessor: (c) => {
          const count = c.files?.length || (c.file ? 1 : 0);
          return count > 0 ? `${count} Document${count > 1 ? "s" : ""} Attached` : "-";
        },
        category: "Files & Documents",
        defaultSelected: false,
      },
      { key: "description", header: "Job Title / Description", accessor: (c) => c.description || "", category: "Basic Information", defaultSelected: false },
      { key: "created_at", header: "Created Date", accessor: (c) => formatDate(c.created_at), category: "System Dates", defaultSelected: false },
      { key: "updated_at", header: "Last Updated", accessor: (c) => formatDate(c.updated_at), category: "System Dates", defaultSelected: false },
    ],
    []
  );

  const getColFilter = (key: string) => filterColumns.find((c) => c.key === key);

  const renderCell = (colKey: string, c: CostingDetail) => {
    const profit = parseFloat(c.profit);
    const profitPercent = parseFloat(c.profit_percent);
    const hasClientRev = Number(c.client_revenue || 0) > 0;
    const items = c.items || [];
    const firstItem = items[0];
    const totalQty = items.reduce((acc, it) => acc + Number(it.quantity || 0), 0);

    if (colKey === "select") {
      return (
        <td key={colKey} className="w-10 px-3 py-3 text-center border-b border-border/60">
          <input
            type="checkbox"
            checked={selected.has(c.id)}
            onChange={() => toggleSelectOne(c.id)}
            className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)] cursor-pointer"
          />
        </td>
      );
    }
    if (colKey === "date") {
      return <td key={colKey} className={`${TD} text-ink-muted whitespace-nowrap`}>{formatDate(c.costing_date)}</td>;
    }
    if (colKey === "client") {
      return (
        <td key={colKey} className={TD}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setViewingCosting(c)}
              className="font-semibold text-ink hover:text-primary-600 hover:underline transition-colors text-left cursor-pointer"
            >
              {c.client_display || "—"}
            </button>
            {c.company_name && (
              <span className="text-[12px] font-medium text-ink-muted">
                ({c.company_name})
              </span>
            )}
          </div>
        </td>
      );
    }
    if (colKey === "company_name") {
      return <td key={colKey} className={`${TD} text-ink-muted`}>{c.company_name || "—"}</td>;
    }
    if (colKey === "project_name") return <td key={colKey} className={`${TD} text-ink-muted`}>{c.project_name || "—"}</td>;
    if (colKey === "file") {
      return (
        <td key={colKey} className={TD}>
          <AttachmentDropdown
            files={
              c.files && c.files.length > 0
                ? c.files
                : c.file
                ? [{ file: c.file, file_name: c.file_name }]
                : []
            }
            maxDisplayWidth="max-w-[110px]"
          />
        </td>
      );
    }
    if (colKey === "supplier") return <td key={colKey} className={`${TD} text-ink-muted`}>{c.supplier_display || "—"}</td>;
    if (colKey === "product") {
      const prodDisplay = c.product_names || c.product_display || "—";
      return (
        <td key={colKey} className={TD}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-ink-muted truncate max-w-[180px]" title={prodDisplay}>
              {prodDisplay}
            </span>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => toggleExpand(c.id)}
                className="inline-flex items-center gap-1 rounded-full bg-primary-50 border border-primary-200 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700 hover:bg-primary-100 transition-colors cursor-pointer"
                title="Expand table items & specifications"
              >
                <Layers className="h-2.5 w-2.5" />
                {items.length}
              </button>
            )}
          </div>
        </td>
      );
    }
    if (colKey === "supplier_rate") {
      return (
        <td key={colKey} className={`${TD} tnum text-right text-ink-muted whitespace-nowrap`}>
          {formatCurrency(firstItem?.supplier_rate || "0")}
          {items.length > 1 && <span className="ml-1 text-[10px] text-ink-faint">(+{items.length - 1})</span>}
        </td>
      );
    }
    if (colKey === "quantity") {
      return (
        <td key={colKey} className={`${TD} tnum text-right text-ink-muted whitespace-nowrap`}>
          {items.length > 0 ? totalQty.toLocaleString() : "1"}
        </td>
      );
    }
    if (colKey === "client_rate") {
      const cRateNum = Number(firstItem?.client_rate || 0);
      return (
        <td key={colKey} className={`${TD} tnum text-right text-ink-muted whitespace-nowrap`}>
          {cRateNum > 0 ? (
            <>
              {formatCurrency(cRateNum)}
              {items.length > 1 && <span className="ml-1 text-[10px] text-ink-faint">(+{items.length - 1})</span>}
            </>
          ) : (
            <span className="text-ink-faint">—</span>
          )}
        </td>
      );
    }
    if (colKey === "supplier_cost") {
      return (
        <td key={colKey} className={`${TD} tnum text-right text-ink-muted`}>
          {formatCurrency(c.supplier_cost || "0")}
        </td>
      );
    }
    if (colKey === "client_revenue") {
      return (
        <td key={colKey} className={`${TD} tnum text-right text-ink-muted`}>
          {hasClientRev ? formatCurrency(c.client_revenue || "0") : <span className="text-ink-faint">—</span>}
        </td>
      );
    }
    if (colKey === "profit") {
      return (
        <td key={colKey} className={clsx(TD, "tnum text-right font-semibold", hasClientRev ? (profit >= 0 ? "text-success-700" : "text-primary-600") : "text-ink-faint")}>
          {hasClientRev ? formatCurrency(c.profit) : "—"}
        </td>
      );
    }
    if (colKey === "profit_percent") {
      return (
        <td key={colKey} className={TD}>
          {hasClientRev ? (
            <span
              className={clsx(
                "ml-auto inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[12px] font-bold",
                profitPercent >= 20 ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"
              )}
            >
              {profitPercent.toFixed(1)}%
            </span>
          ) : (
            <span className="text-ink-faint">—</span>
          )}
        </td>
      );
    }
    if (colKey === "description") return <td key={colKey} className={`${TD} text-ink-muted max-w-[180px] truncate`} title={c.description || ""}>{c.description || "—"}</td>;
    if (colKey === "created_at") return <td key={colKey} className={`${TD} text-xs text-ink-muted whitespace-nowrap`}>{c.created_at ? formatDate(c.created_at) : "—"}</td>;
    if (colKey === "updated_at") return <td key={colKey} className={`${TD} text-xs text-ink-muted whitespace-nowrap`}>{c.updated_at ? formatDate(c.updated_at) : "—"}</td>;
    if (colKey.startsWith("extra_")) {
      const fieldKey = colKey.replace("extra_", "");
      const val = firstItem?.extra_data?.[fieldKey];
      return (
        <td key={colKey} className={`${TD} text-ink-muted`}>
          {val !== undefined && val !== null && val !== "" ? String(val) : "—"}
        </td>
      );
    }
    if (colKey === "actions") {
      return (
        <td key={colKey} className={`${TD} text-right`}>
          <div className="flex justify-end gap-1">
            <RowActionButton label="View" onClick={() => setViewingCosting(c)}>
              <Eye className="h-3.5 w-3.5" />
            </RowActionButton>
            {canAdd && (
              <RowActionButton
                label="Duplicate / Copy Costing"
                onClick={() => handleCopyCosting(c.id)}
                loading={copyingId === c.id}
              >
                <Copy className="h-3.5 w-3.5 text-slate-600" />
              </RowActionButton>
            )}
            {canEdit && (
              <Link href={`/costing/${c.id}`}>
                <RowActionButton label="Edit" onClick={() => {}}>
                  <Pencil className="h-3.5 w-3.5" />
                </RowActionButton>
              </Link>
            )}
            {canDelete && (
              <RowActionButton label="Delete" tone="danger" onClick={() => setDeleting(c)}>
                <Trash2 className="h-3.5 w-3.5" />
              </RowActionButton>
            )}
          </div>
        </td>
      );
    }
    return <td key={colKey} className={TD}>—</td>;
  };

  return (
    <div className="flex flex-col gap-4">
      {selected.size > 0 ? (
        <div className="flex items-center justify-between rounded-md border border-primary-100 bg-primary-50 px-4 py-2.5">
          <span className="text-[13.5px] font-semibold text-primary-700">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <ExportDropdown
              data={costings}
              selectedIds={selected}
              filename="costings_export"
              title="Costing Report"
              columns={costingExportColumns}
              buttonText="Export Selected"
              variant="outline"
            />
            <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            {canDelete && (
              <Button size="sm" variant="primary" onClick={() => setBulkDeleteConfirmOpen(true)} loading={bulkDeleting}>
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
          searchPlaceholder="Search client, company, supplier, product..."
          filters={filterColumns}
          activeFilters={activeFilters}
          onFilterChange={(k, v) => {
            setFilter(k, v);
          }}
          onReset={() => {
            resetFilters();
            setSearch("");
            setSelectedClient(null);
            setSelectedGroup("all");
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
                data={costings}
                selectedIds={selected}
                filename="costings_export"
                title="Costing Report"
                columns={costingExportColumns}
              />
              <ColumnSelector
                columns={grid.columns}
                visibleColumns={grid.visibleColumns}
                onChange={grid.setVisibleColumns}
                onReorder={grid.reorderColumns}
                onReset={grid.resetGrid}
              />
              {canAdd && (
                <Link href="/costing/new">
                  <Button variant="primary">
                    <Plus className="h-4 w-4" /> New Costing
                  </Button>
                </Link>
              )}
            </div>
          }
        />
      )}

      {/* Client Group Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs -mt-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mr-1 flex items-center gap-1 shrink-0">
            <Layers className="h-3.5 w-3.5 text-primary-600" />
            Group:
          </span>
          <button
            type="button"
            onClick={() => setSelectedGroup("all")}
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
                onClick={() => setSelectedGroup(grp.id)}
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
                    isSelected ? "bg-primary-200/80 text-primary-900" : "bg-sand-100 text-ink-muted"
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

      <Card className="overflow-hidden">
        <div ref={tableScrollRef} className="overflow-auto max-h-[calc(100vh-210px)] relative scrollbar-thin">
          <table className="w-full text-left text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-20">
              <tr className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                <th className="w-8 px-2 py-2.5 text-center sticky top-0 z-20 bg-surface-sunken border-b border-border shadow-2xs">
                  <button
                    type="button"
                    onClick={toggleExpandAll}
                    title={expandedIds.size === costings.length ? "Collapse All" : "Expand All"}
                    className="flex h-6 w-6 items-center justify-center rounded text-ink-muted hover:bg-surface-hover hover:text-ink cursor-pointer transition-colors mx-auto"
                  >
                    {expandedIds.size > 0 && expandedIds.size === costings.length ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                </th>
                {grid.columns
                  .filter((c) => grid.visibleColumns.has(c.key))
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
                            checked={Boolean(costings.length && selected.size === costings.length)}
                            onChange={toggleSelectAll}
                            aria-label="Select all"
                            className="h-4 w-4 rounded border-border-strong accent-[var(--color-primary-500)] cursor-pointer"
                          />
                        </ResizableTh>
                      );
                    }
                    if (col.key === "actions") {
                      return (
                        <ResizableTh key="actions" columnKey="actions" grid={grid} align="right" isDraggable={false}>
                          <span>Actions</span>
                        </ResizableTh>
                      );
                    }
                    const isRight = ["supplier_rate", "quantity", "client_rate", "supplier_cost", "client_revenue", "profit", "profit_percent"].includes(col.key);
                    const filterKey = col.key.startsWith("extra_")
                      ? `custom__${col.key.replace("extra_", "")}`
                      : col.key;
                    const colFilter = getColFilter(filterKey);
                    const isSortable = !["select", "actions", "file"].includes(col.key) && !col.key.startsWith("extra_");
                    const sortDirection = isSortable ? getOrderingFor(col.key) : null;

                    return (
                      <ResizableTh key={col.key} columnKey={col.key} grid={grid} align={isRight ? "right" : "left"}>
                        <div className={clsx("flex items-center gap-1 min-w-0 max-w-full", isRight ? "justify-end" : "justify-start")}>
                          {isSortable ? (
                            <span
                              onClick={() => toggleOrdering(col.key, ["date", "created_at", "updated_at"].includes(col.key))}
                              className="truncate cursor-pointer hover:text-primary-600 transition-colors select-none font-semibold"
                              title={`Click to sort by ${col.label}`}
                            >
                              {col.label}
                            </span>
                          ) : (
                            <span className="truncate">{col.label}</span>
                          )}
                          {isSortable && (
                            <SortButton
                              direction={sortDirection}
                              onClick={() => toggleOrdering(col.key, ["date", "created_at", "updated_at"].includes(col.key))}
                              title={`Sort by ${col.label}`}
                            />
                          )}
                          {colFilter && (
                            <ColumnHeaderFilter
                              column={colFilter}
                              activeFilters={activeFilters}
                              onFilterChange={(k, v) => {
                                setFilter(k, v);
                              }}
                              currentSort={isSortable ? sortDirection : undefined}
                              onSortChange={
                                isSortable
                                  ? (dir) => {
                                      if (!dir) setOrdering(null);
                                      else if (dir === "asc") setOrdering(col.key);
                                      else setOrdering(`-${col.key}`);
                                    }
                                  : undefined
                              }
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
                empty={!loading && costings.length === 0}
                colSpan={grid.visibleColumns.size + 1}
                emptyLabel="No costing sheets found matching criteria."
              />
              {costings.map((c) => {
                const isExpanded = expandedIds.has(c.id);
                const itemCount = c.items?.length || 0;
                return (
                  <Fragment key={c.id}>
                    <tr className={clsx(TR, "transition-colors hover:bg-surface-hover", isExpanded && "bg-surface-hover/40")}>
                      <td className="w-8 px-2 py-2.5 text-center border-b border-border/60">
                        <button
                          type="button"
                          onClick={() => toggleExpand(c.id)}
                          className="flex h-6 w-6 items-center justify-center rounded text-ink-muted hover:bg-surface-hover hover:text-ink cursor-pointer transition-colors mx-auto"
                          title={isExpanded ? "Collapse table details" : "Expand table details"}
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
                        .map((col) => renderCell(col.key, c))}
                    </tr>

                    {/* Expandable Dropdown Row Showing All Table Details */}
                    {isExpanded && (
                      <tr className="bg-surface-sunken/40">
                        <td colSpan={grid.visibleColumns.size + 1} className="p-0 border-b border-border/80">
                          <div
                            style={viewportWidth > 0 ? { width: `${viewportWidth}px` } : undefined}
                            className="sticky left-0 w-full px-6 py-4 bg-gradient-to-b from-surface-sunken/30 to-surface border-l-4 border-l-primary-500 shadow-inner"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-4 pb-2.5 mb-3 border-b border-border/60">
                              <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-primary-600" />
                                <span className="text-xs font-bold uppercase tracking-wider text-ink">
                                  Costing Table Details &amp; Specifications
                                </span>
                                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-semibold text-primary-700">
                                  {itemCount} row{itemCount !== 1 ? "s" : ""}
                                </span>
                              </div>
                              <div className="text-xs text-ink-muted flex items-center gap-2.5">
                                <span>
                                  Client:{" "}
                                  <strong className="text-ink">
                                    {c.client_display || "—"}
                                    {c.company_name ? ` (${c.company_name})` : ""}
                                  </strong>
                                </span>
                                <span>·</span>
                                <span>
                                  Supplier: <strong className="text-ink">{c.supplier_display || "—"}</strong>
                                </span>
                              </div>
                            </div>

                            {!c.items || c.items.length === 0 ? (
                              <div className="py-4 text-center text-xs text-ink-muted italic">
                                No line items added to this costing sheet.
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-md border border-border/80 bg-surface shadow-2xs">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="border-b border-border bg-surface-sunken/70 text-[10px] font-bold uppercase tracking-wider text-ink-faint whitespace-nowrap">
                                      <th className="w-10 px-3 py-2 text-center">#</th>
                                      <th className="min-w-[200px] px-3 py-2">Product &amp; Description</th>
                                      {c.columns_config?.map((col) => (
                                        <th key={col.key} className="px-3 py-2">
                                          {col.label}
                                        </th>
                                      ))}
                                      <th className="px-3 py-2 text-right">Qty</th>
                                      <th className="px-3 py-2 text-right">Supplier Rate</th>
                                      <th className="px-3 py-2 text-right">Supplier Total</th>
                                      <th className="px-3 py-2 text-right">Client Rate</th>
                                      <th className="px-3 py-2 text-right">Client Total</th>
                                      <th className="px-3 py-2 text-right">Profit</th>
                                      <th className="px-3 py-2 text-right">Margin %</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/50">
                                    {c.items.map((item, idx) => {
                                      const qty = Number(item.quantity || 0);
                                      const sRate = Number(item.supplier_rate || 0);
                                      const cRate = Number(item.client_rate || 0);
                                      const hasCRate = cRate > 0;
                                      const sTotal = qty * sRate;
                                      const cTotal = qty * cRate;
                                      const rowProfit = cTotal - sTotal;
                                      const rowPct = sTotal > 0 ? (rowProfit / sTotal) * 100 : 0;
                                      const prodName = item.product_name || (idx === 0 ? c.product_display : "") || "";

                                      return (
                                        <tr key={item.id || idx} className="hover:bg-surface-hover/60 transition-colors">
                                          <td className="px-2.5 py-2 text-center font-mono font-medium text-ink-muted">
                                            {idx + 1}
                                          </td>
                                          <td className="min-w-[180px] max-w-[300px] px-3 py-2">
                                            <div className="font-bold text-ink">{prodName || "—"}</div>
                                            {item.description && (
                                              <div className="text-xs italic text-ink-muted whitespace-pre-line mt-0.5">
                                                {item.description}
                                              </div>
                                            )}
                                          </td>
                                          {c.columns_config?.map((col) => (
                                            <td key={col.key} className="px-3 py-2 text-ink-muted whitespace-nowrap">
                                              {item.extra_data?.[col.key] || item.extra_data?.[col.label] || "—"}
                                            </td>
                                          ))}
                                          <td className="px-3 py-2 text-right font-medium text-ink tnum whitespace-nowrap">
                                            {item.quantity}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono text-ink-muted tnum whitespace-nowrap">
                                            {formatCurrency(sRate, baseCurrency)}
                                          </td>
                                          <td className="px-3 py-2 text-right font-semibold text-ink tnum whitespace-nowrap">
                                            {formatCurrency(sTotal, baseCurrency)}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono text-ink-muted tnum whitespace-nowrap">
                                            {hasCRate ? formatCurrency(cRate, baseCurrency) : "—"}
                                          </td>
                                          <td className="px-3 py-2 text-right font-semibold text-ink tnum whitespace-nowrap">
                                            {hasCRate ? formatCurrency(cTotal, baseCurrency) : "—"}
                                          </td>
                                          <td
                                            className={clsx(
                                              "px-3 py-2 text-right font-mono font-bold tnum whitespace-nowrap",
                                              hasCRate
                                                ? rowProfit >= 0
                                                  ? "text-emerald-700"
                                                  : "text-rose-700"
                                                : "text-ink-faint"
                                            )}
                                          >
                                            {hasCRate ? formatCurrency(rowProfit, baseCurrency) : "—"}
                                          </td>
                                          <td className="px-3 py-2 text-right tnum whitespace-nowrap">
                                            {hasCRate ? (
                                              <span
                                                className={clsx(
                                                  "inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                                                  rowPct >= 20 ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"
                                                )}
                                              >
                                                {rowPct.toFixed(1)}%
                                              </span>
                                            ) : (
                                              <span className="text-ink-faint">—</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {c.description && (
                              <div className="mt-2.5 text-xs text-ink-muted bg-surface-sunken/50 rounded-md px-3 py-2 border border-border/60">
                                <span className="font-bold text-ink">Remarks:</span> {c.description}
                              </div>
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

        {costings.length > 0 && (
          <div className="border-t border-border bg-gradient-to-r from-surface-sunken/60 via-surface to-surface-sunken/60 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Left side: Costing counts, selection indicator, and load-more trigger */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-ink">
                <Receipt className="h-3.5 w-3.5 text-primary-600" />
                <span>
                  {selected.size > 0
                    ? `Selected (${selected.size} of ${totalCount})`
                    : debouncedSearch
                    ? `Search: "${debouncedSearch}"`
                    : "Total Costings"}
                </span>
              </div>
              <span className="text-border">|</span>
              <span className="text-ink-muted text-[11.5px]">
                Showing <strong className="text-ink">{costings.length}</strong> of{" "}
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
                      <span>Load More ({totalCount - costings.length})</span>
                    </>
                  )}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium ml-1">
                  <Check className="h-3 w-3 text-emerald-600" /> All loaded
                </span>
              )}
            </div>

            {/* Right side: Live Financial Summary Bar */}
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap ml-auto">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-ink-muted">Supplier Cost:</span>
                <span className="font-bold text-ink font-mono text-[13px]">
                  {formatCurrency(effectiveTotals.supplierCost, effectiveTotals.baseCurrency)}
                </span>
              </div>

              <div className="h-3.5 w-px bg-border hidden sm:block" />

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-ink-muted">Client Revenue:</span>
                <span className="font-bold text-ink font-mono text-[13px]">
                  {formatCurrency(effectiveTotals.clientRevenue, effectiveTotals.baseCurrency)}
                </span>
              </div>

              <div className="h-3.5 w-px bg-border hidden sm:block" />

              <div
                className={clsx(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold shadow-2xs transition-all",
                  effectiveTotals.profit >= 0
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800 ring-1 ring-emerald-400/20"
                    : "bg-rose-50 border-rose-200 text-rose-800 ring-1 ring-rose-400/20"
                )}
              >
                <span className="text-[10px] uppercase font-bold text-ink-muted">Profit:</span>
                <span
                  className={clsx(
                    "font-mono font-extrabold text-[13px]",
                    effectiveTotals.profit >= 0 ? "text-emerald-700" : "text-rose-700"
                  )}
                >
                  {formatCurrency(effectiveTotals.profit, effectiveTotals.baseCurrency)}
                </span>
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-mono font-bold",
                    effectiveTotals.profitPercent >= 20
                      ? "bg-emerald-200/70 text-emerald-900"
                      : effectiveTotals.profit >= 0
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-200/70 text-rose-900"
                  )}
                >
                  {effectiveTotals.profitPercent.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {viewingCosting && (
        <CostingViewModal
          open={Boolean(viewingCosting)}
          costing={viewingCosting}
          onClose={() => setViewingCosting(null)}
          canEdit={canEdit}
        />
      )}

      {deleting && (
        <ConfirmDialog
          open
          onClose={() => setDeleting(null)}
          title="Delete costing sheet"
          description="Delete this costing sheet? This can be undone later from the archive."
          onConfirm={async () => {
            try {
              await apiFetch(`/api/costings/${deleting.id}/`, { method: "DELETE" });
              toast.success("Costing sheet deleted.");
              setDeleting(null);
              reload();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Couldn't delete this costing sheet.");
            }
          }}
        />
      )}

      {bulkDeleteConfirmOpen && (
        <ConfirmDialog
          open
          onClose={() => setBulkDeleteConfirmOpen(false)}
          title="Delete Selected Costing Sheets"
          description={`Are you sure you want to delete ${selected.size} selected costing sheet(s)? This action can be undone later from the archive.`}
          confirmLabel="Delete All Selected"
          onConfirm={handleBulkDelete}
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
