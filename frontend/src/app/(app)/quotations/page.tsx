"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, MessageSquare, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { usePaginatedList, useList, useDebouncedValue } from "@/lib/hooks";
import { Client, Company, Country, QuotationSummary } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { SendNotificationModal } from "@/components/notifications/SendNotificationModal";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, RowActionButton } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill, QUOTATION_STATUS_TONE, labelize } from "@/components/ui/StatusPill";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";
import { FilterBar } from "@/components/ui/FilterBar";
import { ColumnHeaderFilter } from "@/components/ui/ColumnHeaderFilter";
import { DynamicFilterColumn, useDynamicColumnFilters } from "@/lib/useDynamicColumnFilters";

const QUOTATIONS_PAGE_COLUMNS: ColumnDef[] = [
  { key: "quotation_no", label: "Quotation No", required: true },
  { key: "date", label: "Date" },
  { key: "client_name", label: "Client" },
  { key: "subject", label: "Subject" },
  { key: "status", label: "Status" },
  { key: "subtotal", label: "Total Amount" },
  { key: "actions", label: "Actions", required: true },
];

export default function QuotationsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [cols, setCols] = useState<Set<string>>(new Set(QUOTATIONS_PAGE_COLUMNS.map((c) => c.key)));
  const [deleting, setDeleting] = useState<QuotationSummary | null>(null);
  const [notifyingQuotation, setNotifyingQuotation] = useState<QuotationSummary | null>(null);
  const debouncedSearch = useDebouncedValue(search);

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
          { value: "draft", label: "Draft", dotColor: "#64748b" },
          { value: "sent", label: "Sent", dotColor: "#2563eb" },
          { value: "accepted", label: "Accepted", dotColor: "#16a34a" },
          { value: "rejected", label: "Rejected", dotColor: "#e11d48" },
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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Quotations"
        action={
          canAdd && (
            <Link href="/quotations/new">
              <Button variant="primary">
                <Plus className="h-4 w-4" /> New Quotation
              </Button>
            </Link>
          )
        }
      />

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
              filename="quotations_export"
              title="Quotations Report"
              columns={[
                { header: "Quotation No", accessor: (q) => q.quotation_no },
                { header: "Date", accessor: (q) => q.quotation_date },
                { header: "Client", accessor: (q) => q.client_name || "" },
                { header: "Subject", accessor: (q) => q.subject || "" },
                { header: "Status", accessor: (q) => q.status },
                { header: "Currency", accessor: (q) => q.currency_code || "INR" },
                { header: "Subtotal", accessor: (q) => q.subtotal },
              ]}
            />
            <ColumnSelector columns={QUOTATIONS_PAGE_COLUMNS} visibleColumns={cols} onChange={setCols} />
          </div>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken/40 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                {cols.has("quotation_no") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Quotation No</span>
                      {getColFilter("quotation_no") && (
                        <ColumnHeaderFilter
                          column={getColFilter("quotation_no")!}
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
                {cols.has("subject") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Subject</span>
                      {getColFilter("subject") && (
                        <ColumnHeaderFilter
                          column={getColFilter("subject")!}
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
                {cols.has("status") && (
                  <th className={TH}>
                    <div className="inline-flex items-center">
                      <span>Status</span>
                      {getColFilter("status") && (
                        <ColumnHeaderFilter
                          column={getColFilter("status")!}
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
                {cols.has("subtotal") && (
                  <th className={`${TH} text-right`}>
                    <div className="inline-flex items-center justify-end">
                      <span>Total</span>
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
                {cols.has("actions") && <th className={`${TH} text-right`}>Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <TableState loading={loading} empty={!loading && (data?.results.length ?? 0) === 0} colSpan={cols.size} emptyLabel="No quotations yet." />
              {data?.results.map((q) => (
                <tr key={q.id} className={`${TR} hover:bg-surface-hover transition-colors`}>
                  {cols.has("quotation_no") && (
                    <td className={TD}>
                      <Link href={`/quotations/${q.id}`} className="font-mono text-[13px] font-semibold text-ink hover:text-primary-500">
                        {q.quotation_no}
                      </Link>
                    </td>
                  )}
                  {cols.has("date") && <td className={`${TD} text-ink-muted`}>{formatDate(q.quotation_date)}</td>}
                  {cols.has("client_name") && (
                    <td className={TD}>
                      {q.client_name ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-ink">{q.client_name}</span>
                          {q.company_name && (
                            <span className="text-[12px] font-medium text-ink-muted">
                              ({q.company_name})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                  )}
                  {cols.has("subject") && <td className={`${TD} text-ink-muted`}>{q.subject || "—"}</td>}
                  {cols.has("status") && (
                    <td className={TD}>
                      <StatusPill label={labelize(q.status)} tone={QUOTATION_STATUS_TONE[q.status]} />
                    </td>
                  )}
                  {cols.has("subtotal") && <td className={`${TD} tnum text-right font-semibold text-ink`}>{formatCurrency(q.subtotal, q.currency_code)}</td>}
                  {cols.has("actions") && (
                    <td className={`${TD} text-right`}>
                      <div className="flex justify-end gap-1">
                        <RowActionButton label="Send Notification (WhatsApp / Email)" onClick={() => setNotifyingQuotation(q)}>
                          <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                        </RowActionButton>
                        <Link href={`/quotations/${q.id}/print`} target="_blank">
                          <RowActionButton label="Print / Save PDF" onClick={() => {}}>
                            <Printer className="h-3.5 w-3.5 text-primary-600" />
                          </RowActionButton>
                        </Link>
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
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && <Pagination count={data.count} page={page} onPageChange={setPage} />}
      </Card>

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
