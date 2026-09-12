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
  const [cols, setCols] = useState<Set<string>>(
    new Set(["select", "date", "client", "file", "supplier", "product", "supplier_rate", "quantity", "client_rate", "profit", "profit_percent", "actions"])
  );
  const [viewingCosting, setViewingCosting] = useState<CostingDetail | null>(null);
  const [deleting, setDeleting] = useState<CostingDetail | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const baseFilterColumns: DynamicFilterColumn[] = useMemo(
    () => [
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
        key: "amount",
        label: "Supplier Cost",
        type: "amount_range",
      },
      {
        key: "profit",
        label: "Profit",
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

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selected.size} selected costing sheet(s)?`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all(
        Array.from(selected).map((id) => apiFetch(`/api/costings/${id}/`, { method: "DELETE" }))
      );
      toast.success(`${selected.size} costing sheet(s) deleted successfully`);
      setSelected(new Set());
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
      header: "Attached Files URLs",
      accessor: (c) => {
        const list = c.files?.length
          ? c.files.map((f) => mediaUrl(f.file || f.file_url || "") || f.file || "")
          : c.file
          ? [mediaUrl(c.file) || c.file]
          : [];
        return list.filter(Boolean).join(", ");
      },
      category: "Files & Documents",
      defaultSelected: true,
    },
    { key: "description", header: "Job Title / Description", accessor: (c) => c.description || "", category: "Basic Information", defaultSelected: true },
    { key: "created_at", header: "Created Date", accessor: (c) => formatDate(c.created_at), category: "System Dates" },
    { key: "updated_at", header: "Last Updated", accessor: (c) => formatDate(c.updated_at), category: "System Dates" },
  ], []);

  const getColFilter = (key: string) => filterColumns.find((c) => c.key === key);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Costing"
        action={
          canAdd && (
            <Link href="/costing/new">
              <Button variant="primary">
                <Plus className="h-4 w-4" /> New Costing
              </Button>
            </Link>
          )
        }
      />

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
            <ColumnSelector columns={COSTING_PAGE_COLUMNS} visibleColumns={cols} onChange={setCols} />
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
                onClick={bulkDelete}
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
                {cols.has("client") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Client</span>
                      {getColFilter("client") && (
                        <ColumnHeaderFilter
                          column={getColFilter("client")!}
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
                {cols.has("project_name") && <th className={TH}>Project Name</th>}
                {cols.has("file") && <th className={TH}>Attachment</th>}
                {cols.has("supplier") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Supplier</span>
                      {getColFilter("supplier") && (
                        <ColumnHeaderFilter
                          column={getColFilter("supplier")!}
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
                {cols.has("product") && <th className={TH}>Product</th>}
                {cols.has("supplier_rate") && <th className={`${TH} text-right`}>Supplier Rate</th>}
                {cols.has("quantity") && <th className={`${TH} text-right`}>Qty</th>}
                {cols.has("client_rate") && <th className={`${TH} text-right`}>Client Rate</th>}
                {cols.has("supplier_cost") && <th className={`${TH} text-right`}>Supplier Total Cost</th>}
                {cols.has("client_revenue") && <th className={`${TH} text-right`}>Client Total Revenue</th>}
                {cols.has("profit") && (
                  <th className={`${TH} text-right`}>
                    <div className="inline-flex items-center justify-end">
                      <span>Profit</span>
                      {getColFilter("profit") && (
                        <ColumnHeaderFilter
                          column={getColFilter("profit")!}
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
                {cols.has("profit_percent") && <th className={`${TH} text-right`}>Profit %</th>}
                {cols.has("description") && <th className={TH}>Remarks / Notes</th>}
                {cols.has("created_at") && <th className={TH}>Created Date</th>}
                {cols.has("updated_at") && <th className={TH}>Updated Date</th>}
                {cols.has("actions") && <th className={TH}></th>}
              </tr>
            </thead>
            <tbody>
              <TableState loading={loading} empty={!loading && (data?.results.length ?? 0) === 0} colSpan={cols.size} emptyLabel="No costing sheets yet." />
              {data?.results.map((c) => {
                const profit = parseFloat(c.profit);
                const profitPercent = parseFloat(c.profit_percent);
                const firstItem = c.items?.[0];
                return (
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
                    {cols.has("date") && <td className={`${TD} text-ink-muted`}>{formatDate(c.costing_date)}</td>}
                    {cols.has("client") && (
                      <td className={TD}>
                        <button
                          type="button"
                          onClick={() => setViewingCosting(c)}
                          className="font-medium text-ink hover:text-primary-600 hover:underline transition-colors text-left"
                        >
                          {c.client_display || "—"}
                        </button>
                      </td>
                    )}
                    {cols.has("project_name") && <td className={`${TD} text-ink-muted`}>{c.project_name || "—"}</td>}
                    {cols.has("file") && (
                      <td className={TD}>
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
                    )}
                    {cols.has("supplier") && <td className={`${TD} text-ink-muted`}>{c.supplier_display || "—"}</td>}
                    {cols.has("product") && <td className={`${TD} text-ink-muted`}>{c.product_display || "—"}</td>}
                    {cols.has("supplier_rate") && (
                      <td className={`${TD} tnum text-right text-ink-muted`}>
                        {formatCurrency(firstItem?.supplier_rate || "0")}
                      </td>
                    )}
                    {cols.has("quantity") && (
                      <td className={`${TD} tnum text-right text-ink-muted`}>
                        {firstItem?.quantity || "1"}
                      </td>
                    )}
                    {cols.has("client_rate") && (
                      <td className={`${TD} tnum text-right text-ink-muted`}>
                        {formatCurrency(firstItem?.client_rate || "0")}
                      </td>
                    )}
                    {cols.has("supplier_cost") && (
                      <td className={`${TD} tnum text-right text-ink-muted`}>
                        {formatCurrency(c.supplier_cost || "0")}
                      </td>
                    )}
                    {cols.has("client_revenue") && (
                      <td className={`${TD} tnum text-right text-ink-muted`}>
                        {formatCurrency(c.client_revenue || "0")}
                      </td>
                    )}
                    {cols.has("profit") && (
                      <td className={clsx(TD, "tnum text-right font-semibold", profit >= 0 ? "text-success-700" : "text-primary-600")}>
                        {formatCurrency(c.profit)}
                      </td>
                    )}
                    {cols.has("profit_percent") && (
                      <td className={TD}>
                        <span
                          className={clsx(
                            "ml-auto inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[12px] font-bold",
                            profitPercent >= 20 ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700",
                          )}
                        >
                          {profitPercent.toFixed(1)}%
                        </span>
                      </td>
                    )}
                    {cols.has("description") && <td className={`${TD} text-ink-muted max-w-[180px] truncate`} title={c.description || ""}>{c.description || "—"}</td>}
                    {cols.has("created_at") && <td className={`${TD} text-xs text-ink-muted`}>{c.created_at ? formatDate(c.created_at) : "—"}</td>}
                    {cols.has("updated_at") && <td className={`${TD} text-xs text-ink-muted`}>{c.updated_at ? formatDate(c.updated_at) : "—"}</td>}
                    {cols.has("actions") && (
                      <td className={`${TD} text-right`}>
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
                    )}
                  </tr>
                );
              })}
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
    </div>
  );
}
