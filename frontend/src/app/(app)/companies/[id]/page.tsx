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
  Globe,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Search,
  Share2,
  ShieldCheck,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError, Paginated } from "@/lib/api";
import { useList } from "@/lib/hooks";
import { Client, Company, Country, OrderSummary, QuotationSummary } from "@/lib/types";
import { formatCurrency, formatDate, mediaUrl } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/SlideOver";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ColumnDef, ColumnSelector } from "@/components/ui/ColumnSelector";
import { FilterBar, FilterGroupConfig } from "@/components/ui/FilterBar";
import { ColumnHeaderFilter } from "@/components/ui/ColumnHeaderFilter";
import { DynamicFilterColumn } from "@/lib/useDynamicColumnFilters";
import { LoadingState } from "@/components/ui/LoadingState";
import { ExportDropdown } from "@/components/ui/ExportDropdown";

const CLIENT_FILTER_CONFIGS: FilterGroupConfig[] = [
  {
    key: "client_type",
    label: "Client Type",
    options: [
      { value: "A", label: "Type A (Enterprise)", dotColor: "#9333ea" },
      { value: "B", label: "Type B (Standard)", dotColor: "#2563eb" },
      { value: "C", label: "Type C (Small/Retail)", dotColor: "#d97706" },
    ],
  },
];

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
];
import { StatusPill, DELIVERY_STATUS_TONE, PAYMENT_STATUS_TONE, QUOTATION_STATUS_TONE, labelize } from "@/components/ui/StatusPill";
import { TD, TH, TR, TableState } from "@/components/ui/Table";
import { CompanyForm } from "../CompanyForm";
import { ClientForm } from "../../clients/page";
import clsx from "clsx";

const TABS = [
  { key: "overview", label: "Overview & Profile" },
  { key: "clients", label: "Associated Clients" },
  { key: "orders", label: "Orders History" },
  { key: "quotations", label: "Quotations" },
];

const TYPE_TONE: Record<string, string> = {
  A: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
  B: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  C: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
};

const CLIENT_COLUMNS: ColumnDef[] = [
  { key: "client_name", label: "Client Name", required: true },
  { key: "client_type", label: "Type" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "country_name", label: "Country" },
  { key: "actions", label: "Actions", required: true },
];

const ORDER_COLUMNS: ColumnDef[] = [
  { key: "order_no", label: "Order No", required: true },
  { key: "date", label: "Date" },
  { key: "client_name", label: "Client" },
  { key: "project_name", label: "Project" },
  { key: "grand_total", label: "Grand Total" },
  { key: "delivery_status", label: "Delivery Status" },
  { key: "payment_status", label: "Payment Status" },
  { key: "actions", label: "Actions", required: true },
];

const QUOTATION_COLUMNS: ColumnDef[] = [
  { key: "quotation_no", label: "Quotation No", required: true },
  { key: "quotation_date", label: "Date" },
  { key: "client_name", label: "Client" },
  { key: "subject", label: "Subject" },
  { key: "status", label: "Status" },
  { key: "subtotal", label: "Subtotal" },
  { key: "actions", label: "Actions", required: true },
];

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const companyId = Number(params.id);
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();

  const [company, setCompany] = useState<Company | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [quotations, setQuotations] = useState<QuotationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");

  // Tab Column Visibility States
  const [clientCols, setClientCols] = useState<Set<string>>(new Set(CLIENT_COLUMNS.map((c) => c.key)));
  const [orderCols, setOrderCols] = useState<Set<string>>(new Set(ORDER_COLUMNS.map((c) => c.key)));
  const [quoteCols, setQuoteCols] = useState<Set<string>>(new Set(QUOTATION_COLUMNS.map((c) => c.key)));

  // Tab Filter States
  const [clientSearch, setClientSearch] = useState("");
  const [clientTypeFilter, setClientTypeFilter] = useState("");
  const [clientCountryFilter, setClientCountryFilter] = useState("");

  const [orderSearch, setOrderSearch] = useState("");
  const [orderClientFilter, setOrderClientFilter] = useState("");
  const [orderDeliveryFilter, setOrderDeliveryFilter] = useState("");
  const [orderPaymentFilter, setOrderPaymentFilter] = useState("");
  const [orderAmountMin, setOrderAmountMin] = useState("");
  const [orderAmountMax, setOrderAmountMax] = useState("");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");

  const [quoteSearch, setQuoteSearch] = useState("");
  const [quoteClientFilter, setQuoteClientFilter] = useState("");
  const [quoteStatusFilter, setQuoteStatusFilter] = useState("");
  const [quoteAmountMin, setQuoteAmountMin] = useState("");
  const [quoteAmountMax, setQuoteAmountMax] = useState("");
  const [quoteDateFrom, setQuoteDateFrom] = useState("");
  const [quoteDateTo, setQuoteDateTo] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { items: countries } = useList<Country>("/api/countries/");

  const clientFilterConfigs: FilterGroupConfig[] = useMemo(() => [
    {
      key: "client_type",
      label: "Client Type",
      options: [
        { value: "A", label: "Type A (Enterprise)", dotColor: "#9333ea" },
        { value: "B", label: "Type B (Standard)", dotColor: "#2563eb" },
        { value: "C", label: "Type C (Small/Retail)", dotColor: "#d97706" },
      ],
    },
    {
      key: "country",
      label: "Country",
      options: countries.map((c) => ({ value: c.code, label: c.name })),
    },
  ], [countries]);

  const orderFilterConfigs: FilterGroupConfig[] = useMemo(() => [
    {
      key: "client",
      label: "Client",
      options: clients.map((c) => ({ value: String(c.id), label: c.client_name })),
    },
    {
      key: "delivery_status",
      label: "Delivery",
      options: [
        { value: "pending", label: "Pending", dotColor: "#64748b" },
        { value: "in_process", label: "In Process", dotColor: "#2563eb" },
        { value: "ready", label: "Ready", dotColor: "#0d9488" },
        { value: "delivered", label: "Delivered", dotColor: "#16a34a" },
      ],
    },
    {
      key: "payment_status",
      label: "Payment",
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
  ], [clients]);

  const quotationFilterConfigs: FilterGroupConfig[] = useMemo(() => [
    {
      key: "client",
      label: "Client",
      options: clients.map((c) => ({ value: String(c.id), label: c.client_name })),
    },
    {
      key: "status",
      label: "Status",
      options: [
        { value: "draft", label: "Draft", dotColor: "#64748b" },
        { value: "sent", label: "Sent", dotColor: "#2563eb" },
        { value: "accepted", label: "Accepted", dotColor: "#16a34a" },
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
  ], [clients]);

  async function loadData() {
    try {
      const [compRes, clientsRes, ordersRes, quotesRes] = await Promise.all([
        apiFetch<Company>(`/api/companies/${companyId}/`),
        apiFetch<Paginated<Client>>(`/api/clients/?company=${companyId}&page_size=200`).catch(() => ({ results: [] as Client[], count: 0 })),
        apiFetch<Paginated<OrderSummary>>(`/api/orders/?client__company=${companyId}&page_size=200`).catch(() => ({ results: [] as OrderSummary[], count: 0 })),
        apiFetch<Paginated<QuotationSummary>>(`/api/quotations/?client__company=${companyId}&page_size=200`).catch(() => ({ results: [] as QuotationSummary[], count: 0 })),
      ]);

      setCompany(compRes);
      setClients(clientsRes.results || []);
      setOrders(ordersRes.results || []);
      setQuotations(quotesRes.results || []);
    } catch {
      toast.error("Couldn't load company profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!companyId || isNaN(companyId)) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const stats = useMemo(() => {
    const totalRev = orders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
    const paidOrders = orders.filter((o) => o.payment_status === "paid");
    const paidRev = paidOrders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
    const pendingRev = totalRev - paidRev;

    return {
      totalClients: clients.length,
      totalOrders: orders.length,
      totalRevenue: totalRev,
      paidRevenue: paidRev,
      pendingRevenue: Math.max(0, pendingRev),
      totalQuotations: quotations.length,
    };
  }, [clients, orders, quotations]);

  // Filtered Client Rows
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchSearch =
        !clientSearch ||
        c.client_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.phone.toLowerCase().includes(clientSearch.toLowerCase());
      const matchType = !clientTypeFilter || c.client_type === clientTypeFilter;
      const matchCountry = !clientCountryFilter || String(c.country) === clientCountryFilter;
      return matchSearch && matchType && matchCountry;
    });
  }, [clients, clientSearch, clientTypeFilter, clientCountryFilter]);

  // Filtered Order Rows
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        !orderSearch ||
        o.order_no.toLowerCase().includes(orderSearch.toLowerCase()) ||
        o.client_name.toLowerCase().includes(orderSearch.toLowerCase()) ||
        (o.project_name && o.project_name.toLowerCase().includes(orderSearch.toLowerCase()));
      const matchClient = !orderClientFilter || String(o.client) === orderClientFilter;
      const matchDelivery = !orderDeliveryFilter || o.delivery_status === orderDeliveryFilter;
      const matchPayment = !orderPaymentFilter || o.payment_status === orderPaymentFilter;
      const amount = Number(o.grand_total || 0);
      const matchMinAmount = !orderAmountMin || amount >= Number(orderAmountMin);
      const matchMaxAmount = !orderAmountMax || amount <= Number(orderAmountMax);
      const matchDateFrom = !orderDateFrom || o.date >= orderDateFrom;
      const matchDateTo = !orderDateTo || o.date <= orderDateTo;

      return (
        matchSearch &&
        matchClient &&
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
    orderClientFilter,
    orderDeliveryFilter,
    orderPaymentFilter,
    orderAmountMin,
    orderAmountMax,
    orderDateFrom,
    orderDateTo,
  ]);

  // Filtered Quotation Rows
  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      const matchSearch =
        !quoteSearch ||
        q.quotation_no.toLowerCase().includes(quoteSearch.toLowerCase()) ||
        (q.client_name && q.client_name.toLowerCase().includes(quoteSearch.toLowerCase())) ||
        (q.subject && q.subject.toLowerCase().includes(quoteSearch.toLowerCase()));
      const matchClient = !quoteClientFilter || String(q.client) === quoteClientFilter;
      const matchStatus = !quoteStatusFilter || q.status === quoteStatusFilter;
      const amount = Number(q.subtotal || 0);
      const matchMinAmount = !quoteAmountMin || amount >= Number(quoteAmountMin);
      const matchMaxAmount = !quoteAmountMax || amount <= Number(quoteAmountMax);
      const matchDateFrom = !quoteDateFrom || q.quotation_date >= quoteDateFrom;
      const matchDateTo = !quoteDateTo || q.quotation_date <= quoteDateTo;

      return (
        matchSearch &&
        matchClient &&
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
    quoteClientFilter,
    quoteStatusFilter,
    quoteAmountMin,
    quoteAmountMax,
    quoteDateFrom,
    quoteDateTo,
  ]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingState size="lg" label="Loading Company Profile..." sublabel="Fetching client relationships & ledger" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Building2 className="h-10 w-10 text-ink-faint" />
        <h2 className="mt-3 text-lg font-bold text-ink">Company Not Found</h2>
        <Button variant="secondary" onClick={() => router.push("/companies")} className="mt-4">
          <ArrowLeft className="h-4 w-4" /> Back to Companies
        </Button>
      </div>
    );
  }

  const canEdit = can("companies", "edit");
  const canDelete = can("companies", "delete");
  const canAddClient = can("clients", "add");

  return (
    <div className="flex flex-col gap-6">
      {/* Top Breadcrumb navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/companies")}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Companies
        </button>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="secondary" onClick={() => setEditOpen(true)} className="h-9">
              <Pencil className="h-3.5 w-3.5" /> Edit Company
            </Button>
          )}
          {canDelete && (
            <Button variant="secondary" onClick={() => setDeleting(true)} className="h-9 text-rose-600 hover:bg-rose-50 hover:text-rose-700">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
        </div>
      </div>

      {/* Hero Branding Header Banner */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {mediaUrl(company.logo) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl(company.logo)!}
                alt={company.company_name}
                width={72}
                height={72}
                className="h-[72px] w-[72px] rounded-xl border border-border object-contain p-1.5 shadow-xs bg-white flex-none"
              />
            ) : (
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex-none">
                <Building2 className="h-8 w-8" />
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-ink">{company.company_name}</h1>
                {company.vat_id && (
                  <span className="rounded-md bg-surface-sunken px-2 py-0.5 font-mono text-[11px] font-bold text-ink-muted">
                    VAT: {company.vat_id}
                  </span>
                )}
                {company.reg_no && (
                  <span className="rounded-md bg-surface-sunken px-2 py-0.5 font-mono text-[11px] font-bold text-ink-muted">
                    Reg: {company.reg_no}
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
                {company.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-ink-faint" /> {company.city}
                    {company.state ? `, ${company.state}` : ""}
                    {company.country_name ? ` (${company.country_name})` : ""}
                  </span>
                )}
                {company.contact_email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-ink-faint" /> {company.contact_email}
                  </span>
                )}
                {company.contact_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-ink-faint" /> {company.contact_phone}
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
            <span>Clients</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-ink">{stats.totalClients}</div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-ink-faint text-xs font-bold uppercase tracking-wider">
            <span>Orders Placed</span>
            <Receipt className="h-4 w-4 text-primary-500" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-ink">{stats.totalOrders}</div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-ink-faint text-xs font-bold uppercase tracking-wider">
            <span>Total Revenue</span>
            <Wallet className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-ink">{formatCurrency(stats.totalRevenue)}</div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-ink-faint text-xs font-bold uppercase tracking-wider">
            <span>Quotations</span>
            <FileText className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-ink">{stats.totalQuotations}</div>
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
              {t.key === "clients" && ` (${clients.length})`}
              {t.key === "orders" && ` (${orders.length})`}
              {t.key === "quotations" && ` (${quotations.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Overview & Profile */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Contact Details Card */}
          <Card className="p-5">
            <h3 className="mb-4 text-[15px] font-bold text-ink">Contact Person & Phone</h3>
            <dl className="flex flex-col divide-y divide-border/60 text-sm">
              <div className="flex justify-between py-2.5">
                <dt className="text-ink-muted">Contact Person</dt>
                <dd className="font-semibold text-ink">{company.contact_name || "—"}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-ink-muted">Contact Email</dt>
                <dd className="font-semibold text-ink">{company.contact_email || "—"}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-ink-muted">Contact Mobile</dt>
                <dd className="font-semibold text-ink">{company.contact_phone || "—"}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-ink-muted">Company Direct Phone</dt>
                <dd className="font-semibold text-ink">{company.company_phone || "—"}</dd>
              </div>
            </dl>
          </Card>

          {/* Registration & Location */}
          <Card className="p-5">
            <h3 className="mb-4 text-[15px] font-bold text-ink">Address & Tax Information</h3>
            <dl className="flex flex-col divide-y divide-border/60 text-sm">
              <div className="flex justify-between py-2.5">
                <dt className="text-ink-muted">Tax / VAT ID</dt>
                <dd className="font-mono font-bold text-ink">{company.vat_id || "—"}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-ink-muted">Registration Number</dt>
                <dd className="font-mono font-bold text-ink">{company.reg_no || "—"}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-ink-muted">Country & Region</dt>
                <dd className="font-semibold text-ink">{company.country_name || "—"}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-ink-muted">Address</dt>
                <dd className="font-medium text-ink max-w-[240px] text-right">
                  {company.address ? `${company.address}, ` : ""}
                  {company.city ? `${company.city}, ` : ""}
                  {company.state ? `${company.state} ` : ""}
                  {company.zip_code || ""}
                  {!company.address && !company.city && "—"}
                </dd>
              </div>
            </dl>
          </Card>

          {/* Social Links & Web */}
          <Card className="p-5">
            <h3 className="mb-4 text-[15px] font-bold text-ink">Online & Social Profiles</h3>
            <div className="flex flex-col gap-2.5 text-sm">
              {company.linkedin ? (
                <a href={company.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline">
                  <Share2 className="h-4 w-4" /> LinkedIn Profile
                </a>
              ) : (
                <p className="text-xs text-ink-muted">No LinkedIn profile registered.</p>
              )}
              {company.twitter && (
                <a href={company.twitter} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sky-500 hover:underline">
                  <Share2 className="h-4 w-4" /> Twitter / X Profile
                </a>
              )}
              {company.facebook && (
                <a href={company.facebook} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-700 hover:underline">
                  <Share2 className="h-4 w-4" /> Facebook Page
                </a>
              )}
            </div>
          </Card>

          {/* Remarks & Internal Notes */}
          <Card className="p-5">
            <h3 className="mb-4 text-[15px] font-bold text-ink">Internal Remarks</h3>
            <p className="whitespace-pre-wrap text-sm text-ink-muted leading-relaxed">
              {company.remarks || "No internal notes or remarks specified for this company."}
            </p>
          </Card>
        </div>
      )}

      {/* Tab 2: Associated Clients */}
      {tab === "clients" && (
        <Card>
          <div className="p-4 border-b border-border">
            <FilterBar
              search={clientSearch}
              onSearchChange={setClientSearch}
              searchPlaceholder="Search clients by name, email, phone..."
              filters={clientFilterConfigs}
              activeFilters={{
                client_type: clientTypeFilter,
                country: clientCountryFilter,
              }}
              onFilterChange={(key, val) => {
                if (key === "client_type") setClientTypeFilter(val);
                if (key === "country") setClientCountryFilter(val);
              }}
              onReset={() => {
                setClientSearch("");
                setClientTypeFilter("");
                setClientCountryFilter("");
              }}
              actions={
                <div className="flex items-center gap-2">
                  <ExportDropdown
                    data={filteredClients}
                    filename={`${company?.company_name?.replace(/\s+/g, "_") || "company"}_clients`}
                    title={`${company?.company_name || "Company"} - Associated Clients`}
                    columns={[
                      { header: "Client Name", accessor: (c) => c.client_name },
                      { header: "Type", accessor: (c) => `Type ${c.client_type}` },
                      { header: "Phone", accessor: (c) => c.phone || "" },
                      { header: "Email", accessor: (c) => c.email || "" },
                      { header: "Country", accessor: (c) => c.country_name || "" },
                    ]}
                  />
                  <ColumnSelector
                    columns={CLIENT_COLUMNS}
                    visibleColumns={clientCols}
                    onChange={setClientCols}
                  />
                  {canAddClient && (
                    <Button size="sm" variant="primary" onClick={() => setAddClientOpen(true)}>
                      <Plus className="h-3.5 w-3.5" /> Add Client
                    </Button>
                  )}
                </div>
              }
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {clientCols.has("client_name") && (
                    <th className={TH}>
                      <div className="inline-flex items-center">
                        <span>Client Name</span>
                        <ColumnHeaderFilter
                          column={{ key: "search", label: "Client Name", type: "text" }}
                          activeFilters={{ search: clientSearch }}
                          onFilterChange={(_, v) => setClientSearch(v)}
                        />
                      </div>
                    </th>
                  )}
                  {clientCols.has("client_type") && (
                    <th className={TH}>
                      <div className="inline-flex items-center">
                        <span>Type</span>
                        <ColumnHeaderFilter
                          column={CLIENT_FILTER_CONFIGS.find((f) => f.key === "client_type") as DynamicFilterColumn}
                          activeFilters={{ client_type: clientTypeFilter }}
                          onFilterChange={(_, v) => setClientTypeFilter(v)}
                        />
                      </div>
                    </th>
                  )}
                  {clientCols.has("phone") && <th className={TH}>Phone</th>}
                  {clientCols.has("email") && <th className={TH}>Email</th>}
                  {clientCols.has("country_name") && <th className={TH}>Country</th>}
                  {clientCols.has("actions") && <th className={TH}></th>}
                </tr>
              </thead>
              <tbody>
                <TableState
                  loading={false}
                  empty={filteredClients.length === 0}
                  colSpan={clientCols.size}
                  emptyLabel={clients.length === 0 ? "No clients associated with this company yet." : "No clients match filter criteria."}
                />
                {filteredClients.map((c) => (
                  <tr key={c.id} className={TR}>
                    {clientCols.has("client_name") && (
                      <td className={`${TD} font-semibold`}>
                        <Link href={`/clients/${c.id}`} className="text-ink hover:text-primary-600 transition-colors">
                          {c.client_name}
                        </Link>
                      </td>
                    )}
                    {clientCols.has("client_type") && (
                      <td className={TD}>
                        <span className={clsx("inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold", TYPE_TONE[c.client_type])}>
                          {c.client_type}
                        </span>
                      </td>
                    )}
                    {clientCols.has("phone") && <td className={`${TD} text-ink-muted`}>{c.phone || "—"}</td>}
                    {clientCols.has("email") && <td className={`${TD} text-ink-muted`}>{c.email || "—"}</td>}
                    {clientCols.has("country_name") && <td className={`${TD} text-ink-muted`}>{c.country_name || "—"}</td>}
                    {clientCols.has("actions") && (
                      <td className={`${TD} text-right`}>
                        <Link href={`/clients/${c.id}`}>
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

      {/* Tab 3: Orders History */}
      {tab === "orders" && (
        <Card>
          <div className="p-4 border-b border-border">
            <FilterBar
              search={orderSearch}
              onSearchChange={setOrderSearch}
              searchPlaceholder="Search orders by number, client, project..."
              filters={orderFilterConfigs}
              activeFilters={{
                client: orderClientFilter,
                delivery_status: orderDeliveryFilter,
                payment_status: orderPaymentFilter,
                amount_min: orderAmountMin,
                amount_max: orderAmountMax,
                date_from: orderDateFrom,
                date_to: orderDateTo,
              }}
              onFilterChange={(key, val) => {
                if (key === "client") setOrderClientFilter(val);
                if (key === "delivery_status") setOrderDeliveryFilter(val);
                if (key === "payment_status") setOrderPaymentFilter(val);
                if (key === "amount_min") setOrderAmountMin(val);
                if (key === "amount_max") setOrderAmountMax(val);
                if (key === "date_from") setOrderDateFrom(val);
                if (key === "date_to") setOrderDateTo(val);
              }}
              onReset={() => {
                setOrderSearch("");
                setOrderClientFilter("");
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
                    filename={`${company?.company_name?.replace(/\s+/g, "_") || "company"}_orders`}
                    title={`${company?.company_name || "Company"} - Orders Report`}
                    columns={[
                      { header: "Order No", accessor: (o) => o.order_no },
                      { header: "Date", accessor: (o) => o.date },
                      { header: "Client", accessor: (o) => o.client_name },
                      { header: "Project", accessor: (o) => o.project_name || "" },
                      { header: "Grand Total", accessor: (o) => `${o.currency_code || "INR"} ${o.grand_total}` },
                      { header: "Delivery Status", accessor: (o) => o.delivery_status },
                      { header: "Payment Status", accessor: (o) => o.payment_status },
                    ]}
                  />
                  <ColumnSelector
                    columns={ORDER_COLUMNS}
                    visibleColumns={orderCols}
                    onChange={setOrderCols}
                  />
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
                        <span>Order No</span>
                        <ColumnHeaderFilter
                          column={{ key: "search", label: "Order No", type: "text" }}
                          activeFilters={{ search: orderSearch }}
                          onFilterChange={(_, v) => setOrderSearch(v)}
                        />
                      </div>
                    </th>
                  )}
                  {orderCols.has("date") && <th className={TH}>Date</th>}
                  {orderCols.has("client_name") && <th className={TH}>Client</th>}
                  {orderCols.has("project_name") && <th className={TH}>Project</th>}
                  {orderCols.has("grand_total") && <th className={`${TH} text-right`}>Grand Total</th>}
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
                  emptyLabel={orders.length === 0 ? "No orders placed by this company's clients yet." : "No orders match filter criteria."}
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
                    {orderCols.has("client_name") && <td className={`${TD} font-medium text-ink`}>{o.client_name}</td>}
                    {orderCols.has("project_name") && <td className={`${TD} text-ink-muted`}>{o.project_name || "—"}</td>}
                    {orderCols.has("grand_total") && (
                      <td className={`${TD} tnum text-right font-mono font-bold text-ink`}>{formatCurrency(o.grand_total, o.currency_code)}</td>
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

      {/* Tab 4: Quotations */}
      {tab === "quotations" && (
        <Card>
          <div className="p-4 border-b border-border">
            <FilterBar
              search={quoteSearch}
              onSearchChange={setQuoteSearch}
              searchPlaceholder="Search quotations by number, subject, client..."
              filters={quotationFilterConfigs}
              activeFilters={{
                client: quoteClientFilter,
                status: quoteStatusFilter,
                amount_min: quoteAmountMin,
                amount_max: quoteAmountMax,
                date_from: quoteDateFrom,
                date_to: quoteDateTo,
              }}
              onFilterChange={(key, val) => {
                if (key === "client") setQuoteClientFilter(val);
                if (key === "status") setQuoteStatusFilter(val);
                if (key === "amount_min") setQuoteAmountMin(val);
                if (key === "amount_max") setQuoteAmountMax(val);
                if (key === "date_from") setQuoteDateFrom(val);
                if (key === "date_to") setQuoteDateTo(val);
              }}
              onReset={() => {
                setQuoteSearch("");
                setQuoteClientFilter("");
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
                    filename={`${company?.company_name?.replace(/\s+/g, "_") || "company"}_quotations`}
                    title={`${company?.company_name || "Company"} - Quotations Report`}
                    columns={[
                      { header: "Quotation No", accessor: (q) => q.quotation_no },
                      { header: "Date", accessor: (q) => q.quotation_date },
                      { header: "Client", accessor: (q) => q.client_name || "" },
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
                  {quoteCols.has("quotation_date") && <th className={TH}>Date</th>}
                  {quoteCols.has("client_name") && <th className={TH}>Client</th>}
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
                  {quoteCols.has("subtotal") && <th className={`${TH} text-right`}>Subtotal</th>}
                  {quoteCols.has("actions") && <th className={TH}></th>}
                </tr>
              </thead>
              <tbody>
                <TableState
                  loading={false}
                  empty={filteredQuotations.length === 0}
                  colSpan={quoteCols.size}
                  emptyLabel={quotations.length === 0 ? "No quotations generated for this company yet." : "No quotations match filter criteria."}
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
                    {quoteCols.has("client_name") && <td className={`${TD} font-medium text-ink`}>{q.client_name || "—"}</td>}
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

      {/* In-place Edit SlideOver */}
      <SlideOver open={editOpen} onClose={() => setEditOpen(false)} title="Edit Company Information">
        <CompanyForm
          company={company}
          countries={countries}
          onCancel={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            loadData();
          }}
        />
      </SlideOver>

      {/* Add Client SlideOver */}
      <SlideOver open={addClientOpen} onClose={() => setAddClientOpen(false)} title={`Add Client for ${company.company_name}`}>
        <ClientForm
          client={null}
          defaultCompanyId={company.id}
          countries={countries}
          onCancel={() => setAddClientOpen(false)}
          onSaved={() => {
            setAddClientOpen(false);
            loadData();
          }}
        />
      </SlideOver>

      {/* Delete Dialog */}
      {deleting && (
        <ConfirmDialog
          open
          onClose={() => setDeleting(false)}
          title="Delete company"
          description={`Are you sure you want to delete "${company.company_name}"?`}
          onConfirm={async () => {
            try {
              await apiFetch(`/api/companies/${company.id}/`, { method: "DELETE" });
              toast.success("Company deleted.");
              router.push("/companies");
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Couldn't delete this company.");
            }
          }}
        />
      )}
    </div>
  );
}
