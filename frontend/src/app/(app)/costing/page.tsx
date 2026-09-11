"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { usePaginatedList, useList } from "@/lib/hooks";
import { Client, CostingDetail, Supplier } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
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

const COSTING_PAGE_COLUMNS: ColumnDef[] = [
  { key: "date", label: "Date", required: true },
  { key: "client", label: "Client" },
  { key: "supplier", label: "Supplier" },
  { key: "product", label: "Product" },
  { key: "profit", label: "Profit" },
  { key: "profit_percent", label: "Profit %" },
  { key: "actions", label: "Actions", required: true },
];

export default function CostingPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [cols, setCols] = useState<Set<string>>(new Set(COSTING_PAGE_COLUMNS.map((c) => c.key)));
  const [deleting, setDeleting] = useState<CostingDetail | null>(null);

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
              filename="costings_export"
              title="Costing Report"
              columns={[
                { header: "Date", accessor: (c) => c.costing_date },
                { header: "Client", accessor: (c) => c.client_display || "" },
                { header: "Supplier", accessor: (c) => c.supplier_display || "" },
                { header: "Product", accessor: (c) => c.product_display || "" },
                { header: "Supplier Cost", accessor: (c) => c.supplier_cost },
                { header: "Client Revenue", accessor: (c) => c.client_revenue },
                { header: "Profit", accessor: (c) => c.profit },
                { header: "Profit %", accessor: (c) => `${parseFloat(c.profit_percent).toFixed(1)}%` },
              ]}
            />
            <ColumnSelector columns={COSTING_PAGE_COLUMNS} visibleColumns={cols} onChange={setCols} />
          </div>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
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
                {cols.has("actions") && <th className={TH}></th>}
              </tr>
            </thead>
            <tbody>
              <TableState loading={loading} empty={!loading && (data?.results.length ?? 0) === 0} colSpan={cols.size} emptyLabel="No costing sheets yet." />
              {data?.results.map((c) => {
                const profit = parseFloat(c.profit);
                const profitPercent = parseFloat(c.profit_percent);
                return (
                  <tr key={c.id} className={TR}>
                    {cols.has("date") && <td className={`${TD} text-ink-muted`}>{formatDate(c.costing_date)}</td>}
                    {cols.has("client") && <td className={`${TD} text-ink`}>{c.client_display || "—"}</td>}
                    {cols.has("supplier") && <td className={`${TD} text-ink-muted`}>{c.supplier_display || "—"}</td>}
                    {cols.has("product") && <td className={`${TD} text-ink-muted`}>{c.product_display || "—"}</td>}
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
                    {cols.has("actions") && (
                      <td className={`${TD} text-right`}>
                        <div className="flex justify-end gap-1">
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
