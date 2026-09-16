"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { usePaginatedList, useList } from "@/lib/hooks";
import { Client, CostingDetail, Supplier } from "@/lib/types";
import { formatCurrency, formatDate, mediaUrl } from "@/lib/format";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { ExportColumn } from "@/lib/export-utils";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, RowActionButton } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";
import { FilterBar } from "@/components/ui/FilterBar";
import { ColumnHeaderFilter } from "@/components/ui/ColumnHeaderFilter";
import { DynamicFilterColumn, useDynamicColumnFilters } from "@/lib/useDynamicColumnFilters";
import { CostingViewModal } from "./CostingViewModal";
import { AttachmentDropdown } from "@/components/ui/AttachmentDropdown";
import { useTableGrid } from "@/lib/useTableGrid";
import { ResizableTh } from "@/components/ui/ResizableTh";

const COSTING_PAGE_COLUMNS: ColumnDef[] = [
  { key: "select", label: "Select", required: true },
  { key: "date", label: "Date", required: true },
  { key: "client", label: "Client" },
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
  const [page, setPage] = useState(1);
  const [viewingCosting, setViewingCosting] = useState<CostingDetail | null>(null);
  const [deleting, setDeleting] = useState<CostingDetail | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const grid = useTableGrid({
    tableKey: "costing",
    defaultColumns: COSTING_PAGE_COLUMNS,
    defaultVisibleKeys: ["select", "date", "client", "file", "supplier", "product", "supplier_rate", "quantity", "client_rate", "profit", "profit_percent", "actions"],
  });

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
    activeFilters,
    setFilter,
    resetFilters,
    appendQueryParams,
  } = useDynamicColumnFilters({
    module: "costing_item",
    baseColumns: baseFilterColumns,
  });

  const path = useMemo(() => {
    const params = new URLSearchParams();
    appendQueryParams(params);
    params.set("page", String(page));
    return `/api/costings/?${params.toString()}`;
  }, [appendQueryParams, page]);

  const { data, loading, reload } = usePaginatedList<CostingDetail>(path);

  const canAdd = can("costing", "add");
  const canEdit = can("costing", "edit");
  const canDelete = can("costing", "delete");

  const toggleSelectAll = () => {
    if (!data?.results) return;
    if (selected.size === data.results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.results.map((c) => c.id)));
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

  const costingExportColumns: ExportColumn<CostingDetail>[] = useMemo(() => [
    { key: "costing_date", header: "Costing Date", accessor: (c) => c.costing_date, category: "Basic Information", defaultSelected: true },
    { key: "client_display", header: "Client Name", accessor: (c) => c.client_display || "", category: "Basic Information", defaultSelected: true },
    { key: "supplier_display", header: "Supplier Name", accessor: (c) => c.supplier_display || "", category: "Basic Information", defaultSelected: true },
    { key: "product_display", header: "Product Name", accessor: (c) => c.product_display || "", category: "Basic Information", defaultSelected: true },
    { key: "supplier_rate", header: "Supplier Unit Rate", accessor: (c) => c.items?.[0]?.supplier_rate || "0", category: "Rates & Quantities", defaultSelected: true },
    { key: "quantity", header: "Quantity", accessor: (c) => c.items?.[0]?.quantity || "1", category: "Rates & Quantities", defaultSelected: true },
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
  ], []);

  const getColFilter = (key: string) => filterColumns.find((c) => c.key === key);

  const renderCell = (colKey: string, c: CostingDetail) => {
    const profit = parseFloat(c.profit);
    const profitPercent = parseFloat(c.profit_percent);
    const firstItem = c.items?.[0];

    if (colKey === "select") {
      return (
        <td key={colKey} className="w-10 px-3 py-2 text-center">
          <input
            type="checkbox"
            checked={selected.has(c.id)}
            onChange={() => toggleSelectOne(c.id)}
            className="h-3.5 w-3.5 rounded border-border-strong text-primary-500 focus:ring-primary-500/20"
          />
        </td>
      );
    }
    if (colKey === "date") return <td key={colKey} className={`${TD} text-ink-muted`}>{formatDate(c.costing_date)}</td>;
    if (colKey === "client") {
      return (
        <td key={colKey} className={TD}>
          <button
            type="button"
            onClick={() => setViewingCosting(c)}
            className="font-medium text-ink hover:text-primary-600 hover:underline transition-colors text-left"
          >
            {c.client_display || "—"}
          </button>
        </td>
      );
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
    if (colKey === "product") return <td key={colKey} className={`${TD} text-ink-muted`}>{c.product_display || "—"}</td>;
    if (colKey === "supplier_rate") {
      return (
        <td key={colKey} className={`${TD} tnum text-right text-ink-muted`}>
          {formatCurrency(firstItem?.supplier_rate || "0")}
        </td>
      );
    }
    if (colKey === "quantity") {
      return (
        <td key={colKey} className={`${TD} tnum text-right text-ink-muted`}>
          {firstItem?.quantity || "1"}
        </td>
      );
    }
    if (colKey === "client_rate") {
      return (
        <td key={colKey} className={`${TD} tnum text-right text-ink-muted`}>
          {formatCurrency(firstItem?.client_rate || "0")}
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
          {formatCurrency(c.client_revenue || "0")}
        </td>
      );
    }
    if (colKey === "profit") {
      return (
        <td key={colKey} className={clsx(TD, "tnum text-right font-semibold", profit >= 0 ? "text-success-700" : "text-primary-600")}>
          {formatCurrency(c.profit)}
        </td>
      );
    }
    if (colKey === "profit_percent") {
      return (
        <td key={colKey} className={TD}>
          <span
            className={clsx(
              "ml-auto inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[12px] font-bold",
              profitPercent >= 20 ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700",
            )}
          >
            {profitPercent.toFixed(1)}%
          </span>
        </td>
      );
    }
    if (colKey === "description") return <td key={colKey} className={`${TD} text-ink-muted max-w-[180px] truncate`} title={c.description || ""}>{c.description || "—"}</td>;
    if (colKey === "created_at") return <td key={colKey} className={`${TD} text-xs text-ink-muted`}>{c.created_at ? formatDate(c.created_at) : "—"}</td>;
    if (colKey === "updated_at") return <td key={colKey} className={`${TD} text-xs text-ink-muted`}>{c.updated_at ? formatDate(c.updated_at) : "—"}</td>;
    if (colKey === "actions") {
      return (
        <td key={colKey} className={`${TD} text-right`}>
          <div className="flex justify-end gap-1">
            <RowActionButton label="View" onClick={() => setViewingCosting(c)}>
              <Eye className="h-3.5 w-3.5" />
            </RowActionButton>
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
      <FilterBar
        filters={filterColumns}
        activeFilters={activeFilters}
        onFilterChange={(k, v) => {
          setFilter(k, v);
          setPage(1);
        }}
        onReset={() => {
          resetFilters();
          setPage(1);
        }}
        actions={
          <div className="flex items-center gap-2">
            <ExportDropdown
              data={data?.results || []}
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

      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-900 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2 font-medium">
            <span>{selected.size} costing sheet(s) selected</span>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-primary-600 hover:text-primary-800 underline ml-2"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2">
            <ExportDropdown
              data={data?.results || []}
              selectedIds={selected}
              filename="costings_export"
              title="Costing Report"
              columns={costingExportColumns}
            />
            {canDelete && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setBulkDeleteConfirmOpen(true)}
                loading={bulkDeleting}
                className="h-8"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete Selected ({selected.size})
              </Button>
            )}
          </div>
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {grid.columns
                  .filter((c) => grid.visibleColumns.has(c.key))
                  .map((col) => {
                    if (col.key === "select") {
                      return (
                        <ResizableTh key="select" columnKey="select" grid={grid} isDraggable={false} isResizable={false} align="center" className="w-10 px-3 text-center">
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
                        <ResizableTh key="actions" columnKey="actions" grid={grid} align="right" isDraggable={false}>
                          <span className="sr-only">Actions</span>
                        </ResizableTh>
                      );
                    }
                    const isRight = ["supplier_rate", "quantity", "client_rate", "supplier_cost", "client_revenue", "profit", "profit_percent"].includes(col.key);
                    const colFilter = getColFilter(col.key);

                    return (
                      <ResizableTh key={col.key} columnKey={col.key} grid={grid} align={isRight ? "right" : "left"}>
                        <div className={`inline-flex items-center ${isRight ? "justify-end" : ""}`}>
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
            <tbody>
              <TableState
                loading={loading}
                empty={!loading && (data?.results.length ?? 0) === 0}
                colSpan={grid.visibleColumns.size}
                emptyLabel="No costing sheets yet."
              />
              {data?.results.map((c) => (
                <tr key={c.id} className={TR}>
                  {grid.columns
                    .filter((col) => grid.visibleColumns.has(col.key))
                    .map((col) => renderCell(col.key, c))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && <Pagination count={data.count} page={page} onPageChange={setPage} />}
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
    </div>
  );
}
