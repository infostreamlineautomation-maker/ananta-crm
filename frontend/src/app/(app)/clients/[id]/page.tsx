"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Eye,
  FileText,
  FolderKanban,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  MessageSquare,
  Receipt,
  Search,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError, Paginated } from "@/lib/api";
import { useList } from "@/lib/hooks";
import { Client, CommunicationLog, Country, CustomFieldDefinition, OrderSummary, ProjectSummary, QuotationSummary } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/SlideOver";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";
import { FilterBar, FilterGroupConfig } from "@/components/ui/FilterBar";
import { ColumnHeaderFilter } from "@/components/ui/ColumnHeaderFilter";
import { DynamicFilterColumn } from "@/lib/useDynamicColumnFilters";
import { SendNotificationModal } from "@/components/notifications/SendNotificationModal";
import { LoadingState } from "@/components/ui/LoadingState";
import { ExportDropdown } from "@/components/ui/ExportDropdown";

const ORDER_FILTER_CONFIGS: FilterGroupConfig[] = [
  {
    key: "delivery_status",
    label: "Delivery Status",
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
    options: [
      { value: "pending", label: "Pending", dotColor: "#e11d48" },
      { value: "partial", label: "Partial", dotColor: "#d97706" },
      { value: "paid", label: "Paid", dotColor: "#16a34a" },
    ],
  },
  {
    key: "amount",
    label: "Amount",
    type: "amount_range",
  },
  {
    key: "date",
    label: "Date",
    type: "date_range",
  },
];

const QUOTATION_FILTER_CONFIGS: FilterGroupConfig[] = [
  {
    key: "status",
    label: "Proposal Status",
    options: [
      { value: "draft", label: "Draft", dotColor: "#64748b" },
      { value: "sent", label: "Sent", dotColor: "#2563eb" },
      { value: "accepted", label: "Accepted (Won)", dotColor: "#16a34a" },
      { value: "rejected", label: "Rejected", dotColor: "#e11d48" },
    ],
  },
  {
    key: "amount",
    label: "Amount",
    type: "amount_range",
  },
  {
    key: "date",
    label: "Date",
    type: "date_range",
  },
];

const PROJECT_FILTER_CONFIGS: FilterGroupConfig[] = [
  {
    key: "status",
    label: "Project Status",
    options: [
      { value: "active", label: "Active", dotColor: "#16a34a" },
      { value: "on_hold", label: "On Hold", dotColor: "#d97706" },
      { value: "completed", label: "Completed", dotColor: "#2563eb" },
      { value: "cancelled", label: "Cancelled", dotColor: "#e11d48" },
    ],
  },
];
import { StatusPill, DELIVERY_STATUS_TONE, PAYMENT_STATUS_TONE, QUOTATION_STATUS_TONE, labelize } from "@/components/ui/StatusPill";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { ActivityTimeline } from "@/components/ui/ActivityTimeline";
import { ClientForm } from "../page";
import clsx from "clsx";

const TABS = [
  { key: "overview", label: "Overview & Account" },
  { key: "timeline", label: "Relationship Timeline" },
  { key: "orders", label: "Projects" },
  { key: "quotations", label: "Quotations" },
  { key: "communications", label: "Communication History" },
];

const TYPE_TONE: Record<string, string> = {
  A: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
  B: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  C: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
};

const TYPE_LABEL: Record<string, string> = {
  A: "Type A (Enterprise)",
  B: "Type B (Standard)",
  C: "Type C (Small/Retail)",
};

const ORDER_COLUMNS: ColumnDef[] = [
  { key: "order_no", label: "Project No", required: true },
  { key: "date", label: "Date" },
  { key: "grand_total", label: "Grand Total" },
  { key: "delivery_status", label: "Delivery Status" },
  { key: "payment_status", label: "Payment Status" },
  { key: "actions", label: "Actions", required: true },
];

const QUOTATION_COLUMNS: ColumnDef[] = [
  { key: "quotation_no", label: "Quotation No", required: true },
  { key: "quotation_date", label: "Date" },
  { key: "subject", label: "Subject" },
  { key: "status", label: "Status" },
  { key: "subtotal", label: "Total" },
  { key: "actions", label: "Actions", required: true },
];

const PROJECT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Project Name", required: true },
  { key: "description", label: "Description" },
  { key: "status", label: "Status" },
  { key: "orders_count", label: "Orders" },
  { key: "quotations_count", label: "Quotations" },
  { key: "total_order_value", label: "Order Value" },
  { key: "actions", label: "Actions", required: true },
];

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const clientId = Number(params.id);
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [quotations, setQuotations] = useState<QuotationSummary[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [communications, setCommunications] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [notifyOpen, setNotifyOpen] = useState(false);

  // Tab Column Visibility States
  const [orderCols, setOrderCols] = useState<Set<string>>(new Set(ORDER_COLUMNS.map((c) => c.key)));
  const [quoteCols, setQuoteCols] = useState<Set<string>>(new Set(QUOTATION_COLUMNS.map((c) => c.key)));
  const [projectCols, setProjectCols] = useState<Set<string>>(new Set(PROJECT_COLUMNS.map((c) => c.key)));

  // Tab Filter States
  const [orderSearch, setOrderSearch] = useState("");
  const [orderDeliveryFilter, setOrderDeliveryFilter] = useState("");
  const [orderPaymentFilter, setOrderPaymentFilter] = useState("");
  const [orderAmountMin, setOrderAmountMin] = useState("");
  const [orderAmountMax, setOrderAmountMax] = useState("");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");

  const [quoteSearch, setQuoteSearch] = useState("");
  const [quoteStatusFilter, setQuoteStatusFilter] = useState("");
  const [quoteAmountMin, setQuoteAmountMin] = useState("");
  const [quoteAmountMax, setQuoteAmountMax] = useState("");
  const [quoteDateFrom, setQuoteDateFrom] = useState("");
  const [quoteDateTo, setQuoteDateTo] = useState("");

  const [projectSearch, setProjectSearch] = useState("");
  const [projectStatusFilter, setProjectStatusFilter] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { items: countries } = useList<Country>("/api/countries/");
  const { items: customFields } = useList<CustomFieldDefinition>("/api/custom-fields/?module=client");

  async function loadData() {
    try {
      const [cliRes, ordersRes, quotesRes, projRes, commsRes] = await Promise.all([
        apiFetch<Client>(`/api/clients/${clientId}/`),
        apiFetch<Paginated<OrderSummary>>(`/api/orders/?client=${clientId}&page_size=200`).catch(() => ({ results: [] as OrderSummary[], count: 0 })),
        apiFetch<Paginated<QuotationSummary>>(`/api/quotations/?client=${clientId}&page_size=200`).catch(() => ({ results: [] as QuotationSummary[], count: 0 })),
        apiFetch<Paginated<ProjectSummary>>(`/api/projects/?client=${clientId}&page_size=200`).catch(() => ({ results: [] as ProjectSummary[], count: 0 })),
        apiFetch<CommunicationLog[]>(`/api/communications/?client=${clientId}`).catch(() => [] as CommunicationLog[]),
      ]);

      setClient(cliRes);
      setOrders(ordersRes.results || []);
      setQuotations(quotesRes.results || []);
      setProjects(projRes.results || []);
      setCommunications(Array.isArray(commsRes) ? commsRes : []);
    } catch {
      toast.error("Couldn't load client profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!clientId || isNaN(clientId)) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const stats = useMemo(() => {
    const totalRev = orders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
    const paidOrders = orders.filter((o) => o.payment_status === "paid");
    const paidRev = paidOrders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
    const pendingRev = totalRev - paidRev;

    return {
      totalOrders: orders.length,
      totalRevenue: totalRev,
      paidRevenue: paidRev,
      pendingRevenue: pendingRev,
      totalQuotations: quotations.length,
      totalProjects: projects.length,
    };
  }, [orders, quotations, projects]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        !orderSearch ||
        o.order_no.toLowerCase().includes(orderSearch.toLowerCase()) ||
        (o.project_name && o.project_name.toLowerCase().includes(orderSearch.toLowerCase()));
      const matchDelivery = !orderDeliveryFilter || o.delivery_status === orderDeliveryFilter;
      const matchPayment = !orderPaymentFilter || o.payment_status === orderPaymentFilter;
      const amount = Number(o.grand_total || 0);
      const matchMinAmount = !orderAmountMin || amount >= Number(orderAmountMin);
      const matchMaxAmount = !orderAmountMax || amount <= Number(orderAmountMax);
      const matchDateFrom = !orderDateFrom || o.date >= orderDateFrom;
      const matchDateTo = !orderDateTo || o.date <= orderDateTo;

      return (
        matchSearch &&
        matchDelivery &&
        matchPayment &&
        matchMinAmount &&
        matchMaxAmount &&
        matchDateFrom &&
        matchDateTo
      );
    });
  }, [
    orders,
    orderSearch,
    orderDeliveryFilter,
    orderPaymentFilter,
    orderAmountMin,
    orderAmountMax,
    orderDateFrom,
    orderDateTo,
  ]);

  // Filtered Quotations
  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      const matchSearch =
        !quoteSearch ||
        q.quotation_no.toLowerCase().includes(quoteSearch.toLowerCase()) ||
        (q.subject && q.subject.toLowerCase().includes(quoteSearch.toLowerCase()));
      const matchStatus = !quoteStatusFilter || q.status === quoteStatusFilter;
      const amount = Number(q.subtotal || 0);
      const matchMinAmount = !quoteAmountMin || amount >= Number(quoteAmountMin);
      const matchMaxAmount = !quoteAmountMax || amount <= Number(quoteAmountMax);
      const matchDateFrom = !quoteDateFrom || q.quotation_date >= quoteDateFrom;
      const matchDateTo = !quoteDateTo || q.quotation_date <= quoteDateTo;

      return (
        matchSearch &&
        matchStatus &&
        matchMinAmount &&
        matchMaxAmount &&
        matchDateFrom &&
        matchDateTo
      );
    });
  }, [
    quotations,
    quoteSearch,
    quoteStatusFilter,
    quoteAmountMin,
    quoteAmountMax,
    quoteDateFrom,
    quoteDateTo,
  ]);

  // Filtered Projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        !projectSearch ||
        p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(projectSearch.toLowerCase()));
      const matchStatus = !projectStatusFilter || p.status === projectStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [projects, projectSearch, projectStatusFilter]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingState size="lg" label="Loading Client Profile..." sublabel="Fetching account history & records" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <User className="h-10 w-10 text-ink-faint" />
        <h2 className="mt-3 text-lg font-bold text-ink">Client Not Found</h2>
        <Button variant="secondary" onClick={() => router.push("/clients")} className="mt-4">
          <ArrowLeft className="h-4 w-4" /> Back to Clients
        </Button>
      </div>
    );
  }

  const canEdit = can("clients", "edit");
  const canDelete = can("clients", "delete");
  const canAddOrder = can("orders", "add");
  const canAddQuotation = can("quotations", "add");

  const initials = client.client_name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/clients")}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Clients
        </button>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setNotifyOpen(true)}
            className="h-9 gap-1.5 text-emerald-700 hover:text-emerald-800 border-emerald-200 bg-emerald-50/50"
          >
            <MessageSquare className="h-3.5 w-3.5 text-emerald-600" /> Message / Notify
          </Button>
          {canAddOrder && (
            <Link href="/orders/new">
              <Button variant="primary" className="h-9">
                <Plus className="h-3.5 w-3.5" /> New Project
              </Button>
            </Link>
          )}
          {canAddQuotation && (
            <Link href="/quotations/new">
              <Button variant="secondary" className="h-9">
                <FileText className="h-3.5 w-3.5" /> New Quotation
              </Button>
            </Link>
          )}
          {canEdit && (
            <Button variant="secondary" onClick={() => setEditOpen(true)} className="h-9">
              <Pencil className="h-3.5 w-3.5" /> Edit Client
            </Button>
          )}
          {canDelete && (
            <Button variant="secondary" onClick={() => setDeleting(true)} className="h-9 text-rose-600 hover:bg-rose-50 hover:text-rose-700">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
        </div>
      </div>

      {/* Hero Client Card Banner */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-linear-to-br from-primary-500 to-primary-700 text-xl font-extrabold text-white shadow-sm flex-none">
              {initials || "C"}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-ink">{client.client_name}</h1>
                <span className={clsx("rounded-md px-2 py-0.5 text-[11px] font-bold", TYPE_TONE[client.client_type])}>
                  {TYPE_LABEL[client.client_type] || `Type ${client.client_type}`}
                </span>
                {client.currency_code && (
                  <span className="rounded-md bg-surface-sunken px-2 py-0.5 font-mono text-[11px] font-bold text-ink-muted">
                    {client.currency_code}
                  </span>
                )}
                {customFields?.map((f) => {
                  const val = client.extra_data?.[f.field_key];
                  if (!val && val !== false && val !== 0) return null;
                  return (
                    <span
                      key={f.id}
                      className="rounded-md bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700 border border-primary-100"
                    >
                      {f.label}: {String(val)}
                    </span>
                  );
                })}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
                {client.company ? (
                  <Link href={`/companies/${client.company}`} className="flex items-center gap-1 font-semibold text-primary-600 hover:underline">
                    <Building2 className="h-3.5 w-3.5" /> {client.company_name}
                  </Link>
                ) : (
                  <span className="flex items-center gap-1 text-ink-faint">
                    <Building2 className="h-3.5 w-3.5" /> Standalone Account (No Company)
                  </span>
                )}
                {client.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-ink-faint" /> {client.email}
                  </span>
                )}
                {client.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-ink-faint" /> {client.phone}
                  </span>
                )}
                {client.country_name && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-ink-faint" /> {client.country_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* KPI Quick Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-ink-faint text-xs font-bold uppercase tracking-wider">
            <span>Orders Placed</span>
            <Receipt className="h-4 w-4 text-primary-500" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-ink">{stats.totalOrders}</div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-ink-faint text-xs font-bold uppercase tracking-wider">
            <span>Lifetime Revenue</span>
            <Wallet className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-ink">
            {formatCurrency(stats.totalRevenue, client.currency_code || undefined)}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-ink-faint text-xs font-bold uppercase tracking-wider">
            <span>Quotations</span>
            <FileText className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-ink">{stats.totalQuotations}</div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-ink-faint text-xs font-bold uppercase tracking-wider">
            <span>Projects</span>
            <FolderKanban className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-ink">{stats.totalProjects}</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                "pb-3 text-[14px] font-bold transition-all border-b-2 -mb-px px-3",
                tab === t.key
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {t.label}
              {t.key === "orders" && ` (${orders.length})`}
              {t.key === "quotations" && ` (${quotations.length})`}
              {t.key === "projects" && ` (${projects.length})`}
              {t.key === "communications" && ` (${communications.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Overview & Account */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Client Account Info */}
          <Card className="p-5">
            <h3 className="mb-4 text-[15px] font-bold text-ink">Client Account Details</h3>
            <dl className="flex flex-col divide-y divide-border/60 text-sm">
              <div className="flex justify-between py-2.5">
                <dt className="text-ink-muted">Client Name</dt>
                <dd className="font-semibold text-ink">{client.client_name}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-ink-muted">Client Classification</dt>
                <dd className="font-semibold text-ink">{TYPE_LABEL[client.client_type] || client.client_type}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-ink-muted">Email Address</dt>
                <dd className="font-semibold text-ink">{client.email || "—"}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-ink-muted">Phone Number</dt>
                <dd className="font-semibold text-ink">{client.phone || "—"}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-ink-muted">Country & Currency</dt>
                <dd className="font-semibold text-ink">
                  {client.country_name || "—"} {client.currency_code ? `(${client.currency_code})` : ""}
                </dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-ink-muted">Billing Address</dt>
                <dd className="font-medium text-ink max-w-[240px] text-right">{client.address || "—"}</dd>
              </div>
              {customFields?.map((f) => {
                const val = client.extra_data?.[f.field_key];
                return (
                  <div key={f.id} className="flex justify-between py-2.5">
                    <dt className="text-ink-muted">{f.label}</dt>
                    <dd className="font-semibold text-ink">{val ? String(val) : "—"}</dd>
                  </div>
                );
              })}
            </dl>
          </Card>

          {/* Company Affiliation */}
          <Card className="p-5 flex flex-col justify-between">
            <div>
              <h3 className="mb-4 text-[15px] font-bold text-ink">Parent Company Affiliation</h3>
              {client.company ? (
                <div className="rounded-lg border border-border bg-surface-sunken/40 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-ink">{client.company_name}</h4>
                      <p className="text-xs text-ink-muted">Registered Parent Company</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border flex justify-end">
                    <Link href={`/companies/${client.company}`}>
                      <Button size="sm" variant="secondary">
                        <Eye className="h-3.5 w-3.5" /> View Company Profile
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-ink-muted">
                  <p>This client is not linked to any parent company.</p>
                  <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)} className="mt-3">
                    Assign Company
                  </Button>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-ink-muted">
              <span>Account Created: {formatDate(client.created_at)}</span>
              <span>Updated: {formatDate(client.updated_at)}</span>
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Relationship Timeline */}
      {tab === "timeline" && (
        <ActivityTimeline
          endpoint={`/api/clients/${clientId}/timeline/`}
          title={`${client.client_name} — 360° Relationship & Activity Timeline`}
        />
      )}

      {/* Tab 2: Orders History */}
      {tab === "orders" && (
        <Card>
          <div className="p-4 border-b border-border">
            <FilterBar
              search={orderSearch}
              onSearchChange={setOrderSearch}
              searchPlaceholder="Search orders by number, project..."
              filters={ORDER_FILTER_CONFIGS}
              activeFilters={{
                delivery_status: orderDeliveryFilter,
                payment_status: orderPaymentFilter,
                amount_min: orderAmountMin,
                amount_max: orderAmountMax,
                date_from: orderDateFrom,
                date_to: orderDateTo,
              }}
              onFilterChange={(key, val) => {
                if (key === "delivery_status") setOrderDeliveryFilter(val);
                if (key === "payment_status") setOrderPaymentFilter(val);
                if (key === "amount_min") setOrderAmountMin(val);
                if (key === "amount_max") setOrderAmountMax(val);
                if (key === "date_from") setOrderDateFrom(val);
                if (key === "date_to") setOrderDateTo(val);
              }}
              onReset={() => {
                setOrderSearch("");
                setOrderDeliveryFilter("");
                setOrderPaymentFilter("");
                setOrderAmountMin("");
                setOrderAmountMax("");
                setOrderDateFrom("");
                setOrderDateTo("");
              }}
              actions={
                <div className="flex items-center gap-2">
                  <ExportDropdown
                    data={filteredOrders}
                    filename={`${client?.client_name?.replace(/\s+/g, "_") || "client"}_orders`}
                    title={`${client?.client_name || "Client"} - Orders Report`}
                    columns={[
                      { header: "Order No", accessor: (o) => o.order_no },
                      { header: "Date", accessor: (o) => o.date },
                      { header: "Project", accessor: (o) => o.project_name || "" },
                      { header: "Supplier", accessor: (o) => o.supplier_name || "" },
                      { header: "Total Amount", accessor: (o) => `${o.currency_code || "INR"} ${o.grand_total}` },
                      { header: "Paid Amount", accessor: (o) => `${o.currency_code || "INR"} ${o.paid_amount || "0.00"}` },
                      { header: "Balance Due", accessor: (o) => `${o.currency_code || "INR"} ${o.due_amount || "0.00"}` },
                      { header: "Delivery Status", accessor: (o) => o.delivery_status },
                      { header: "Payment Status", accessor: (o) => o.payment_status },
                    ]}
                  />
                  <ColumnSelector
                    columns={ORDER_COLUMNS}
                    visibleColumns={orderCols}
                    onChange={setOrderCols}
                  />
                  {canAddOrder && (
                    <Link href="/orders/new">
                      <Button size="sm" variant="primary">
                        <Plus className="h-3.5 w-3.5" /> Create Project
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
                  {orderCols.has("order_no") && (
                    <th className={TH}>
                      <div className="inline-flex items-center">
                        <span>Project No</span>
                        <ColumnHeaderFilter
                          column={{ key: "search", label: "Project No", type: "text" }}
                          activeFilters={{ search: orderSearch }}
                          onFilterChange={(_, v) => setOrderSearch(v)}
                        />
                      </div>
                    </th>
                  )}
                  {orderCols.has("date") && (
                    <th className={TH}>
                      <div className="inline-flex items-center">
                        <span>Date</span>
                        <ColumnHeaderFilter
                          column={{ key: "date", label: "Date", type: "date_range" }}
                          activeFilters={{ date_from: orderDateFrom, date_to: orderDateTo }}
                          onFilterChange={(k, v) => (k === "date_from" ? setOrderDateFrom(v) : setOrderDateTo(v))}
                        />
                      </div>
                    </th>
                  )}
                  {orderCols.has("grand_total") && (
                    <th className={`${TH} text-right`}>
                      <div className="inline-flex items-center justify-end">
                        <span>Grand Total</span>
                        <ColumnHeaderFilter
                          column={{ key: "amount", label: "Amount", type: "amount_range" }}
                          activeFilters={{ amount_min: orderAmountMin, amount_max: orderAmountMax }}
                          onFilterChange={(k, v) => (k === "amount_min" ? setOrderAmountMin(v) : setOrderAmountMax(v))}
                        />
                      </div>
                    </th>
                  )}
                  {orderCols.has("delivery_status") && (
                    <th className={TH}>
                      <div className="inline-flex items-center">
                        <span>Delivery</span>
                        <ColumnHeaderFilter
                          column={ORDER_FILTER_CONFIGS.find((f) => f.key === "delivery_status") as DynamicFilterColumn}
                          activeFilters={{ delivery_status: orderDeliveryFilter }}
                          onFilterChange={(_, v) => setOrderDeliveryFilter(v)}
                        />
                      </div>
                    </th>
                  )}
                  {orderCols.has("payment_status") && (
                    <th className={TH}>
                      <div className="inline-flex items-center">
                        <span>Payment</span>
                        <ColumnHeaderFilter
                          column={ORDER_FILTER_CONFIGS.find((f) => f.key === "payment_status") as DynamicFilterColumn}
                          activeFilters={{ payment_status: orderPaymentFilter }}
                          onFilterChange={(_, v) => setOrderPaymentFilter(v)}
                        />
                      </div>
                    </th>
                  )}
                  {orderCols.has("actions") && <th className={TH}></th>}
                </tr>
              </thead>
              <tbody>
                <TableState
                  loading={false}
                  empty={filteredOrders.length === 0}
                  colSpan={orderCols.size}
                  emptyLabel={orders.length === 0 ? "No orders placed by this client yet." : "No orders match filter criteria."}
                />
                {filteredOrders.map((o) => (
                  <tr key={o.id} className={TR}>
                    {orderCols.has("order_no") && (
                      <td className={TD}>
                        <Link href={`/orders/${o.id}`} className="font-mono text-[13px] font-semibold text-ink hover:text-primary-600">
                          {o.order_no}
                        </Link>
                      </td>
                    )}
                    {orderCols.has("date") && <td className={`${TD} text-ink-muted`}>{formatDate(o.date)}</td>}
                    {orderCols.has("grand_total") && (
                      <td className={`${TD} tnum text-right font-mono font-bold text-ink`}>{formatCurrency(o.grand_total, o.currency_code || client.currency_code || undefined)}</td>
                    )}
                    {orderCols.has("delivery_status") && (
                      <td className={TD}>
                        <StatusPill label={labelize(o.delivery_status)} tone={DELIVERY_STATUS_TONE[o.delivery_status]} />
                      </td>
                    )}
                    {orderCols.has("payment_status") && (
                      <td className={TD}>
                        <StatusPill label={labelize(o.payment_status)} tone={PAYMENT_STATUS_TONE[o.payment_status]} />
                      </td>
                    )}
                    {orderCols.has("actions") && (
                      <td className={`${TD} text-right`}>
                        <Link href={`/orders/${o.id}`}>
                          <Button size="sm" variant="secondary">
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Quotations */}
      {tab === "quotations" && (
        <Card>
          <div className="p-4 border-b border-border">
            <FilterBar
              search={quoteSearch}
              onSearchChange={setQuoteSearch}
              searchPlaceholder="Search quotations by number, subject..."
              filters={QUOTATION_FILTER_CONFIGS}
              activeFilters={{
                status: quoteStatusFilter,
                amount_min: quoteAmountMin,
                amount_max: quoteAmountMax,
                date_from: quoteDateFrom,
                date_to: quoteDateTo,
              }}
              onFilterChange={(key, val) => {
                if (key === "status") setQuoteStatusFilter(val);
                if (key === "amount_min") setQuoteAmountMin(val);
                if (key === "amount_max") setQuoteAmountMax(val);
                if (key === "date_from") setQuoteDateFrom(val);
                if (key === "date_to") setQuoteDateTo(val);
              }}
              onReset={() => {
                setQuoteSearch("");
                setQuoteStatusFilter("");
                setQuoteAmountMin("");
                setQuoteAmountMax("");
                setQuoteDateFrom("");
                setQuoteDateTo("");
              }}
              actions={
                <div className="flex items-center gap-2">
                  <ExportDropdown
                    data={filteredQuotations}
                    filename={`${client?.client_name?.replace(/\s+/g, "_") || "client"}_quotations`}
                    title={`${client?.client_name || "Client"} - Quotations Report`}
                    columns={[
                      { header: "Quotation No", accessor: (q) => q.quotation_no },
                      { header: "Date", accessor: (q) => q.quotation_date },
                      { header: "Subject", accessor: (q) => q.subject || "" },
                      { header: "Status", accessor: (q) => q.status },
                      { header: "Subtotal", accessor: (q) => `${q.currency_code || "INR"} ${q.subtotal}` },
                    ]}
                  />
                  <ColumnSelector
                    columns={QUOTATION_COLUMNS}
                    visibleColumns={quoteCols}
                    onChange={setQuoteCols}
                  />
                  {canAddQuotation && (
                    <Link href="/quotations/new">
                      <Button size="sm" variant="primary">
                        <Plus className="h-3.5 w-3.5" /> Create Quotation
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
                  {quoteCols.has("quotation_no") && (
                    <th className={TH}>
                      <div className="inline-flex items-center">
                        <span>Quotation No</span>
                        <ColumnHeaderFilter
                          column={{ key: "search", label: "Quotation No", type: "text" }}
                          activeFilters={{ search: quoteSearch }}
                          onFilterChange={(_, v) => setQuoteSearch(v)}
                        />
                      </div>
                    </th>
                  )}
                  {quoteCols.has("quotation_date") && (
                    <th className={TH}>
                      <div className="inline-flex items-center">
                        <span>Date</span>
                        <ColumnHeaderFilter
                          column={{ key: "date", label: "Date", type: "date_range" }}
                          activeFilters={{ date_from: quoteDateFrom, date_to: quoteDateTo }}
                          onFilterChange={(k, v) => (k === "date_from" ? setQuoteDateFrom(v) : setQuoteDateTo(v))}
                        />
                      </div>
                    </th>
                  )}
                  {quoteCols.has("subject") && <th className={TH}>Subject</th>}
                  {quoteCols.has("status") && (
                    <th className={TH}>
                      <div className="inline-flex items-center">
                        <span>Status</span>
                        <ColumnHeaderFilter
                          column={QUOTATION_FILTER_CONFIGS.find((f) => f.key === "status") as DynamicFilterColumn}
                          activeFilters={{ status: quoteStatusFilter }}
                          onFilterChange={(_, v) => setQuoteStatusFilter(v)}
                        />
                      </div>
                    </th>
                  )}
                  {quoteCols.has("subtotal") && (
                    <th className={`${TH} text-right`}>
                      <div className="inline-flex items-center justify-end">
                        <span>Subtotal</span>
                        <ColumnHeaderFilter
                          column={{ key: "amount", label: "Amount", type: "amount_range" }}
                          activeFilters={{ amount_min: quoteAmountMin, amount_max: quoteAmountMax }}
                          onFilterChange={(k, v) => (k === "amount_min" ? setQuoteAmountMin(v) : setQuoteAmountMax(v))}
                        />
                      </div>
                    </th>
                  )}
                  {quoteCols.has("actions") && <th className={TH}></th>}
                </tr>
              </thead>
              <tbody>
                <TableState
                  loading={false}
                  empty={filteredQuotations.length === 0}
                  colSpan={quoteCols.size}
                  emptyLabel={quotations.length === 0 ? "No quotations generated for this client yet." : "No quotations match filter criteria."}
                />
                {filteredQuotations.map((q) => (
                  <tr key={q.id} className={TR}>
                    {quoteCols.has("quotation_no") && (
                      <td className={TD}>
                        <Link href={`/quotations/${q.id}`} className="font-mono text-[13px] font-semibold text-ink hover:text-primary-600">
                          {q.quotation_no}
                        </Link>
                      </td>
                    )}
                    {quoteCols.has("quotation_date") && <td className={`${TD} text-ink-muted`}>{formatDate(q.quotation_date)}</td>}
                    {quoteCols.has("subject") && <td className={`${TD} text-ink-muted`}>{q.subject || "—"}</td>}
                    {quoteCols.has("status") && (
                      <td className={TD}>
                        <StatusPill label={labelize(q.status)} tone={QUOTATION_STATUS_TONE[q.status]} />
                      </td>
                    )}
                    {quoteCols.has("subtotal") && (
                      <td className={`${TD} tnum text-right font-mono font-bold text-ink`}>{formatCurrency(q.subtotal, q.currency_code)}</td>
                    )}
                    {quoteCols.has("actions") && (
                      <td className={`${TD} text-right`}>
                        <div className="flex justify-end gap-1">
                          <Link href={`/quotations/${q.id}/print`}>
                            <Button size="sm" variant="secondary">
                              <Eye className="h-3.5 w-3.5" /> Preview
                            </Button>
                          </Link>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 4: Projects */}
      {tab === "projects" && (
        <Card>
          <div className="p-4 border-b border-border">
            <FilterBar
              search={projectSearch}
              onSearchChange={setProjectSearch}
              searchPlaceholder="Search projects by name, description..."
              filters={PROJECT_FILTER_CONFIGS}
              activeFilters={{ status: projectStatusFilter }}
              onFilterChange={(key, val) => {
                if (key === "status") setProjectStatusFilter(val);
              }}
              onReset={() => {
                setProjectSearch("");
                setProjectStatusFilter("");
              }}
              actions={
                <div className="flex items-center gap-2">
                  <ExportDropdown
                    data={filteredProjects}
                    filename={`${client?.client_name?.replace(/\s+/g, "_") || "client"}_projects`}
                    title={`${client?.client_name || "Client"} - Projects Report`}
                    columns={[
                      { header: "Project Name", accessor: (p) => p.name },
                      { header: "Description", accessor: (p) => p.description || "" },
                      { header: "Status", accessor: (p) => p.status },
                      { header: "Orders Count", accessor: (p) => p.orders_count },
                      { header: "Quotations Count", accessor: (p) => p.quotations_count },
                      { header: "Total Order Value", accessor: (p) => p.total_order_value },
                    ]}
                  />
                  <ColumnSelector
                    columns={PROJECT_COLUMNS}
                    visibleColumns={projectCols}
                    onChange={setProjectCols}
                  />
                </div>
              }
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {projectCols.has("name") && (
                    <th className={TH}>
                      <div className="inline-flex items-center">
                        <span>Project Name</span>
                        <ColumnHeaderFilter
                          column={{ key: "search", label: "Project Name", type: "text" }}
                          activeFilters={{ search: projectSearch }}
                          onFilterChange={(_, v) => setProjectSearch(v)}
                        />
                      </div>
                    </th>
                  )}
                  {projectCols.has("description") && <th className={TH}>Description</th>}
                  {projectCols.has("status") && (
                    <th className={TH}>
                      <div className="inline-flex items-center">
                        <span>Status</span>
                        <ColumnHeaderFilter
                          column={PROJECT_FILTER_CONFIGS.find((f) => f.key === "status") as DynamicFilterColumn}
                          activeFilters={{ status: projectStatusFilter }}
                          onFilterChange={(_, v) => setProjectStatusFilter(v)}
                        />
                      </div>
                    </th>
                  )}
                  {projectCols.has("orders_count") && <th className={`${TH} text-center`}>Orders</th>}
                  {projectCols.has("quotations_count") && <th className={`${TH} text-center`}>Quotations</th>}
                  {projectCols.has("total_order_value") && <th className={`${TH} text-right`}>Order Value</th>}
                  {projectCols.has("actions") && <th className={TH}></th>}
                </tr>
              </thead>
              <tbody>
                <TableState
                  loading={false}
                  empty={filteredProjects.length === 0}
                  colSpan={projectCols.size}
                  emptyLabel={projects.length === 0 ? "No projects associated with this client yet." : "No projects match filter criteria."}
                />
                {filteredProjects.map((p) => (
                  <tr key={p.id} className={TR}>
                    {projectCols.has("name") && (
                      <td className={`${TD} font-semibold`}>
                        <Link href={`/projects/${p.id}`} className="text-ink hover:text-primary-600 transition-colors">
                          {p.name}
                        </Link>
                      </td>
                    )}
                    {projectCols.has("description") && (
                      <td className={`${TD} text-ink-muted max-w-[200px] truncate`}>{p.description || "—"}</td>
                    )}
                    {projectCols.has("status") && (
                      <td className={TD}>
                        <span className="capitalize text-xs font-semibold px-2 py-0.5 rounded-md bg-surface-sunken text-ink">
                          {p.status.replace("_", " ")}
                        </span>
                      </td>
                    )}
                    {projectCols.has("orders_count") && <td className={`${TD} text-center font-mono`}>{p.orders_count}</td>}
                    {projectCols.has("quotations_count") && <td className={`${TD} text-center font-mono`}>{p.quotations_count}</td>}
                    {projectCols.has("total_order_value") && (
                      <td className={`${TD} tnum text-right font-mono font-bold text-ink`}>
                        {formatCurrency(p.total_order_value)}
                      </td>
                    )}
                    {projectCols.has("actions") && (
                      <td className={`${TD} text-right`}>
                        <Link href={`/projects/${p.id}`}>
                          <Button size="sm" variant="secondary">
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 5: Communications History */}
      {tab === "communications" && (
        <Card className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-border">
            <div>
              <h3 className="text-base font-bold text-ink">Communication & Notification History</h3>
              <p className="text-xs text-ink-muted mt-0.5">
                Complete audit trail of WhatsApp notices, invoices, and SMTP emails dispatched to {client.client_name}.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => setNotifyOpen(true)}
              className="gap-1.5 text-xs font-bold whitespace-nowrap"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Send New Message / Email
            </Button>
          </div>

          {communications.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-faint">
              No communications logged for this client yet. Click "Send New Message / Email" to reach out.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {communications.map((c) => (
                <div key={c.id} className="py-4 flex items-start gap-3.5">
                  <div
                    className={clsx(
                      "flex h-9 w-9 items-center justify-center rounded-xl flex-none text-white shadow-xs",
                      c.channel === "whatsapp" ? "bg-emerald-600" : "bg-primary-600"
                    )}
                  >
                    {c.channel === "whatsapp" ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink uppercase tracking-wider">
                          {c.channel === "whatsapp" ? "WhatsApp" : "Email"}
                        </span>
                        <span className="text-xs text-ink-muted">to <strong className="text-ink font-semibold">{c.recipient}</strong></span>
                        {c.order_no && (
                          <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-mono font-semibold text-ink">
                            Order {c.order_no}
                          </span>
                        )}
                        {c.quotation_no && (
                          <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-mono font-semibold text-ink">
                            Quote {c.quotation_no}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-ink-faint">
                        <span>{formatDate(c.created_at)}</span>
                        <span
                          className={clsx(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                            c.status === "sent"
                              ? "bg-emerald-50 text-emerald-700"
                              : c.status === "logged"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-rose-50 text-rose-700"
                          )}
                        >
                          {c.status}
                        </span>
                      </div>
                    </div>

                    {c.subject && (
                      <p className="mt-1 text-xs font-semibold text-ink">
                        {c.subject}
                      </p>
                    )}

                    <div className="mt-1.5 rounded-lg bg-surface-sunken/60 p-3 text-xs text-ink whitespace-pre-line font-sans border border-border/40">
                      {c.message}
                    </div>

                    {c.sent_by_name && (
                      <p className="mt-1.5 text-[11px] text-ink-faint">
                        Dispatched by <span className="font-semibold text-ink-muted">{c.sent_by_name}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Send Notification Modal */}
      {client && (
        <SendNotificationModal
          open={notifyOpen}
          onClose={() => setNotifyOpen(false)}
          onSuccess={loadData}
          target={{
            type: "client",
            id: client.id,
            title: client.client_name,
            clientName: client.client_name,
            clientPhone: client.phone,
            clientEmail: client.email,
          }}
        />
      )}

      {/* In-place Edit SlideOver */}
      <SlideOver open={editOpen} onClose={() => setEditOpen(false)} title="Edit Client Information">
        <ClientForm
          client={client}
          countries={countries}
          onCancel={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            loadData();
          }}
        />
      </SlideOver>

      {/* Delete Dialog */}
      {deleting && (
        <ConfirmDialog
          open
          onClose={() => setDeleting(false)}
          title="Delete client"
          description={`Are you sure you want to delete "${client.client_name}"?`}
          onConfirm={async () => {
            try {
              await apiFetch(`/api/clients/${client.id}/`, { method: "DELETE" });
              toast.success("Client deleted.");
              router.push("/clients");
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Couldn't delete this client.");
            }
          }}
        />
      )}
    </div>
  );
}
