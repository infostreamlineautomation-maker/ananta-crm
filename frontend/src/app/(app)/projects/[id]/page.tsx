"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, Paginated } from "@/lib/api";
import { CostingDetail, OrderSummary, ProjectSummary, QuotationSummary } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/SlideOver";
import { Tabs } from "@/components/ui/Tabs";
import { LoadingState } from "@/components/ui/LoadingState";
import { StatusPill, DELIVERY_STATUS_TONE, PAYMENT_STATUS_TONE, PROJECT_STATUS_TONE, QUOTATION_STATUS_TONE, labelize } from "@/components/ui/StatusPill";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { ProjectForm } from "../page";
import { FilterBar } from "@/components/ui/FilterBar";
import { ColumnHeaderFilter } from "@/components/ui/ColumnHeaderFilter";
import { DynamicFilterColumn } from "@/lib/useDynamicColumnFilters";

const TABS = [
  { key: "orders", label: "Orders" },
  { key: "quotations", label: "Quotations" },
  { key: "costings", label: "Costings" },
];

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("orders");
  const [editOpen, setEditOpen] = useState(false);

  async function loadProject() {
    try {
      const p = await apiFetch<ProjectSummary>(`/api/projects/${projectId}/`);
      setProject(p);
    } catch {
      toast.error("Couldn't load this project.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingState size="lg" label="Loading Project Overview..." sublabel="Fetching timelines & tasks" />
      </div>
    );
  }

  if (!project) {
    return <p className="text-sm text-ink-faint">Project not found.</p>;
  }

  const canEdit = can("projects", "edit");

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => router.push("/projects")} className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink cursor-pointer">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Projects
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-ink">{project.name}</h1>
            <StatusPill label={labelize(project.status)} tone={PROJECT_STATUS_TONE[project.status]} />
          </div>
          <p className="mt-1 text-[13px] text-ink-muted">{project.client_name}</p>
          {project.description && <p className="mt-2 max-w-2xl text-[13.5px] text-ink-muted">{project.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/projects/${project.id}/print`} target="_blank">
            <Button variant="secondary" className="gap-1.5">
              <Printer className="h-4 w-4" /> Print Statement / PDF
            </Button>
          </Link>
          {canEdit && (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 sm:max-w-md">
        <Stat label="Orders" value={String(project.orders_count)} />
        <Stat label="Quotations" value={String(project.quotations_count)} />
        <Stat label="Total Value" value={formatCurrency(project.total_order_value)} emphasis />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "orders" && <OrdersTab projectId={projectId} />}
      {tab === "quotations" && <QuotationsTab projectId={projectId} />}
      {tab === "costings" && <CostingsTab projectId={projectId} />}

      <SlideOver open={editOpen} onClose={() => setEditOpen(false)} title="Edit Project">
        <ProjectForm
          project={project}
          onCancel={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            loadProject();
          }}
        />
      </SlideOver>
    </div>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className={`tnum mt-1 text-lg font-extrabold ${emphasis ? "text-primary-500" : "text-ink"}`}>{value}</p>
    </Card>
  );
}

const ORDER_FILTER_CONFIGS: DynamicFilterColumn[] = [
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
      { value: "partial", label: "Partial", dotColor: "#d97706" },
      { value: "paid", label: "Paid", dotColor: "#16a34a" },
    ],
  },
];

function OrdersTab({ projectId }: { projectId: number }) {
  const { can } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const canAdd = can("orders", "add");

  useEffect(() => {
    apiFetch<Paginated<OrderSummary>>(`/api/orders/?project=${projectId}`)
      .then((res) => setOrders(res.results))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (search && !o.order_no.toLowerCase().includes(search.toLowerCase())) return false;
      if (deliveryStatus && o.delivery_status !== deliveryStatus) return false;
      if (paymentStatus && o.payment_status !== paymentStatus) return false;
      return true;
    });
  }, [orders, search, deliveryStatus, paymentStatus]);

  return (
    <Card>
      <div className="p-4 border-b border-border">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search order number..."
          filters={ORDER_FILTER_CONFIGS}
          activeFilters={{ delivery_status: deliveryStatus, payment_status: paymentStatus }}
          onFilterChange={(k, v) => {
            if (k === "delivery_status") setDeliveryStatus(v);
            if (k === "payment_status") setPaymentStatus(v);
          }}
          onReset={() => {
            setSearch("");
            setDeliveryStatus("");
            setPaymentStatus("");
          }}
          actions={
            <div className="flex items-center gap-2">
              <ExportDropdown
                data={filteredOrders}
                filename={`project_${projectId}_orders`}
                title="Project Orders Report"
                columns={[
                  { header: "Order No", accessor: (o) => o.order_no },
                  { header: "Date", accessor: (o) => o.date },
                  { header: "Client", accessor: (o) => o.client_name },
                  { header: "Supplier", accessor: (o) => o.supplier_name || "" },
                  { header: "Total Amount", accessor: (o) => `${o.currency_code || "INR"} ${o.grand_total}` },
                  { header: "Paid Amount", accessor: (o) => `${o.currency_code || "INR"} ${o.paid_amount || "0.00"}` },
                  { header: "Balance Due", accessor: (o) => `${o.currency_code || "INR"} ${o.due_amount || "0.00"}` },
                  { header: "Delivery Status", accessor: (o) => o.delivery_status },
                  { header: "Payment Status", accessor: (o) => o.payment_status },
                ]}
              />
              {canAdd && (
                <Link href={`/orders/new?project=${projectId}`}>
                  <Button size="sm" variant="secondary">
                    <Plus className="h-3.5 w-3.5" /> New Order
                  </Button>
                </Link>
              )}
            </div>
          }
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>
                <div className="inline-flex items-center">
                  <span>Order No</span>
                  <ColumnHeaderFilter
                    column={{ key: "search", label: "Order No", type: "text" }}
                    activeFilters={{ search }}
                    onFilterChange={(_, v) => setSearch(v)}
                  />
                </div>
              </th>
              <th className={TH}>Date</th>
              <th className={`${TH} text-right`}>Amount</th>
              <th className={TH}>
                <div className="inline-flex items-center">
                  <span>Delivery</span>
                  <ColumnHeaderFilter
                    column={ORDER_FILTER_CONFIGS[0]}
                    activeFilters={{ delivery_status: deliveryStatus }}
                    onFilterChange={(_, v) => setDeliveryStatus(v)}
                  />
                </div>
              </th>
              <th className={TH}>
                <div className="inline-flex items-center">
                  <span>Payment</span>
                  <ColumnHeaderFilter
                    column={ORDER_FILTER_CONFIGS[1]}
                    activeFilters={{ payment_status: paymentStatus }}
                    onFilterChange={(_, v) => setPaymentStatus(v)}
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <TableState loading={loading} empty={!loading && filteredOrders.length === 0} colSpan={5} emptyLabel="No orders linked to this project yet." />
            {filteredOrders.map((o) => (
              <tr key={o.id} className={TR}>
                <td className={TD}>
                  <Link href={`/orders/${o.id}`} className="font-mono text-[13px] font-semibold text-ink hover:text-primary-500">
                    {o.order_no}
                  </Link>
                </td>
                <td className={`${TD} text-ink-muted`}>{formatDate(o.date)}</td>
                <td className={`${TD} tnum text-right font-semibold text-ink`}>{formatCurrency(o.grand_total, o.currency_code)}</td>
                <td className={TD}>
                  <StatusPill label={labelize(o.delivery_status)} tone={DELIVERY_STATUS_TONE[o.delivery_status]} />
                </td>
                <td className={TD}>
                  <StatusPill label={labelize(o.payment_status)} tone={PAYMENT_STATUS_TONE[o.payment_status]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const QUOTATION_FILTER_CONFIGS: DynamicFilterColumn[] = [
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
];

function QuotationsTab({ projectId }: { projectId: number }) {
  const { can } = useAuth();
  const [quotations, setQuotations] = useState<QuotationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const canAdd = can("quotations", "add");

  useEffect(() => {
    apiFetch<Paginated<QuotationSummary>>(`/api/quotations/?project=${projectId}`)
      .then((res) => setQuotations(res.results))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      if (search && !q.quotation_no.toLowerCase().includes(search.toLowerCase()) && !q.subject?.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && q.status !== statusFilter) return false;
      return true;
    });
  }, [quotations, search, statusFilter]);

  return (
    <Card>
      <div className="p-4 border-b border-border">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search quotation number, subject..."
          filters={QUOTATION_FILTER_CONFIGS}
          activeFilters={{ status: statusFilter }}
          onFilterChange={(k, v) => {
            if (k === "status") setStatusFilter(v);
          }}
          onReset={() => {
            setSearch("");
            setStatusFilter("");
          }}
          actions={
            <div className="flex items-center gap-2">
              <ExportDropdown
                data={filteredQuotations}
                filename={`project_${projectId}_quotations`}
                title="Project Quotations Report"
                columns={[
                  { header: "Quotation No", accessor: (q) => q.quotation_no },
                  { header: "Date", accessor: (q) => q.quotation_date },
                  { header: "Client", accessor: (q) => q.client_name || "" },
                  { header: "Subject", accessor: (q) => q.subject || "" },
                  { header: "Status", accessor: (q) => q.status },
                  { header: "Subtotal", accessor: (q) => `${q.currency_code || "INR"} ${q.subtotal}` },
                ]}
              />
              {canAdd && (
                <Link href={`/quotations/new?project=${projectId}`}>
                  <Button size="sm" variant="secondary">
                    <Plus className="h-3.5 w-3.5" /> New Quotation
                  </Button>
                </Link>
              )}
            </div>
          }
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>
                <div className="inline-flex items-center">
                  <span>Quotation No</span>
                  <ColumnHeaderFilter
                    column={{ key: "search", label: "Quotation No", type: "text" }}
                    activeFilters={{ search }}
                    onFilterChange={(_, v) => setSearch(v)}
                  />
                </div>
              </th>
              <th className={TH}>Date</th>
              <th className={TH}>Subject</th>
              <th className={TH}>
                <div className="inline-flex items-center">
                  <span>Status</span>
                  <ColumnHeaderFilter
                    column={QUOTATION_FILTER_CONFIGS[0]}
                    activeFilters={{ status: statusFilter }}
                    onFilterChange={(_, v) => setStatusFilter(v)}
                  />
                </div>
              </th>
              <th className={`${TH} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            <TableState loading={loading} empty={!loading && filteredQuotations.length === 0} colSpan={5} emptyLabel="No quotations linked to this project yet." />
            {filteredQuotations.map((q) => (
              <tr key={q.id} className={TR}>
                <td className={TD}>
                  <Link href={`/quotations/${q.id}`} className="font-mono text-[13px] font-semibold text-ink hover:text-primary-500">
                    {q.quotation_no}
                  </Link>
                </td>
                <td className={`${TD} text-ink-muted`}>{formatDate(q.quotation_date)}</td>
                <td className={`${TD} text-ink-muted`}>{q.subject || "—"}</td>
                <td className={TD}>
                  <StatusPill label={labelize(q.status)} tone={QUOTATION_STATUS_TONE[q.status]} />
                </td>
                <td className={`${TD} tnum text-right font-semibold text-ink`}>{formatCurrency(q.subtotal, q.currency_code)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CostingsTab({ projectId }: { projectId: number }) {
  const { can } = useAuth();
  const [costings, setCostings] = useState<CostingDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const canAdd = can("costing", "add");

  useEffect(() => {
    apiFetch<Paginated<CostingDetail>>(`/api/costings/?project=${projectId}`)
      .then((res) => setCostings(res.results))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <span className="text-[13px] font-semibold text-ink-muted">{costings.length} costing sheet{costings.length === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-2">
          <ExportDropdown
            data={costings}
            filename={`project_${projectId}_costings`}
            title="Project Costings Report"
            columns={[
              { header: "Date", accessor: (c) => c.costing_date },
              { header: "Supplier", accessor: (c) => c.supplier_display || "" },
              { header: "Product", accessor: (c) => c.product_display || "" },
              { header: "Supplier Cost", accessor: (c) => c.supplier_cost },
              { header: "Client Revenue", accessor: (c) => c.client_revenue },
              { header: "Profit", accessor: (c) => c.profit },
              { header: "Profit %", accessor: (c) => `${parseFloat(c.profit_percent).toFixed(1)}%` },
            ]}
          />
          {canAdd && (
            <Link href={`/costing/new?project=${projectId}`}>
              <Button size="sm" variant="secondary">
                <Plus className="h-3.5 w-3.5" /> New Costing
              </Button>
            </Link>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>Date</th>
              <th className={TH}>Supplier</th>
              <th className={TH}>Product</th>
              <th className={`${TH} text-right`}>Profit</th>
              <th className={`${TH} text-right`}>Profit %</th>
            </tr>
          </thead>
          <tbody>
            <TableState loading={loading} empty={!loading && costings.length === 0} colSpan={5} emptyLabel="No costing sheets linked to this project yet." />
            {costings.map((c) => (
              <tr key={c.id} className={TR}>
                <td className={`${TD} text-ink-muted`}>{formatDate(c.costing_date)}</td>
                <td className={`${TD} text-ink-muted`}>{c.supplier_display || "—"}</td>
                <td className={`${TD} text-ink-muted`}>{c.product_display || "—"}</td>
                <td className={`${TD} tnum text-right font-semibold text-success-700`}>{formatCurrency(c.profit)}</td>
                <td className={`${TD} tnum text-right text-ink-muted`}>{parseFloat(c.profit_percent).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
