"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, Paginated } from "@/lib/api";
import { CostingDetail, OrderSummary, ProjectSummary, QuotationSummary } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/SlideOver";
import { Tabs } from "@/components/ui/Tabs";
import { LoadingState } from "@/components/ui/LoadingState";
import { StatusPill, DELIVERY_STATUS_TONE, PAYMENT_STATUS_TONE, PROJECT_STATUS_TONE, QUOTATION_STATUS_TONE, labelize } from "@/components/ui/StatusPill";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { ProjectForm } from "../page";

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
      <button onClick={() => router.push("/projects")} className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink">
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

function OrdersTab({ projectId }: { projectId: number }) {
  const { can } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const canAdd = can("orders", "add");

  useEffect(() => {
    apiFetch<Paginated<OrderSummary>>(`/api/orders/?project=${projectId}`)
      .then((res) => setOrders(res.results))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <span className="text-[13px] font-semibold text-ink-muted">{orders.length} order{orders.length === 1 ? "" : "s"}</span>
        {canAdd && (
          <Link href={`/orders/new?project=${projectId}`}>
            <Button size="sm" variant="secondary">
              <Plus className="h-3.5 w-3.5" /> New Order
            </Button>
          </Link>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>Order No</th>
              <th className={TH}>Date</th>
              <th className={`${TH} text-right`}>Amount</th>
              <th className={TH}>Delivery</th>
              <th className={TH}>Payment</th>
            </tr>
          </thead>
          <tbody>
            <TableState loading={loading} empty={!loading && orders.length === 0} colSpan={5} emptyLabel="No orders linked to this project yet." />
            {orders.map((o) => (
              <tr key={o.id} className={TR}>
                <td className={TD}>
                  <Link href={`/orders/${o.id}`} className="font-mono text-[13px] font-semibold text-ink hover:text-primary-500">
                    {o.order_no}
                  </Link>
                </td>
                <td className={`${TD} text-ink-muted`}>{o.date}</td>
                <td className={`${TD} tnum text-right font-semibold text-ink`}>{formatCurrency(o.grand_total)}</td>
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

function QuotationsTab({ projectId }: { projectId: number }) {
  const { can } = useAuth();
  const [quotations, setQuotations] = useState<QuotationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const canAdd = can("quotations", "add");

  useEffect(() => {
    apiFetch<Paginated<QuotationSummary>>(`/api/quotations/?project=${projectId}`)
      .then((res) => setQuotations(res.results))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <span className="text-[13px] font-semibold text-ink-muted">{quotations.length} quotation{quotations.length === 1 ? "" : "s"}</span>
        {canAdd && (
          <Link href={`/quotations/new?project=${projectId}`}>
            <Button size="sm" variant="secondary">
              <Plus className="h-3.5 w-3.5" /> New Quotation
            </Button>
          </Link>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>Quotation No</th>
              <th className={TH}>Date</th>
              <th className={TH}>Subject</th>
              <th className={TH}>Status</th>
              <th className={`${TH} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            <TableState loading={loading} empty={!loading && quotations.length === 0} colSpan={5} emptyLabel="No quotations linked to this project yet." />
            {quotations.map((q) => (
              <tr key={q.id} className={TR}>
                <td className={TD}>
                  <Link href={`/quotations/${q.id}`} className="font-mono text-[13px] font-semibold text-ink hover:text-primary-500">
                    {q.quotation_no}
                  </Link>
                </td>
                <td className={`${TD} text-ink-muted`}>{q.quotation_date}</td>
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
        {canAdd && (
          <Link href={`/costing/new?project=${projectId}`}>
            <Button size="sm" variant="secondary">
              <Plus className="h-3.5 w-3.5" /> New Costing
            </Button>
          </Link>
        )}
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
                <td className={`${TD} text-ink-muted`}>{c.costing_date}</td>
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
