"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  ClipboardList,
  Percent,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Coins,
  Receipt,
  FileSpreadsheet,
  Users,
  Package,
  Search,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { AnalyticsReport } from "@/lib/types";
import { formatCurrency, getBrandLogo, getReportLogo, mediaUrl } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { DatePresets } from "@/components/charts/DatePresets";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { ProgressBarList } from "@/components/charts/ProgressBarList";
import { ExportDropdown } from "@/components/ui/ExportDropdown";
import { ExportFormat, exportAnalyticsReport, getOrgPrefix } from "@/lib/export-utils";
import { useOrganization } from "@/lib/organization-context";

const TABS = [
  { key: "overview", label: "Overview & Trends" },
  { key: "clients", label: "Client-Wise Report" },
  { key: "products", label: "Product-Wise Report" },
  { key: "pipeline", label: "Pipeline & Margins" },
];

function defaultMonth() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);
  return { from, to };
}

export default function ReportsPage() {
  const { activeOrganization } = useOrganization();
  const initial = useMemo(() => defaultMonth(), []);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [activeTab, setActiveTab] = useState("overview");
  const [clientSearch, setClientSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const [data, setData] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => `date_from=${dateFrom}&date_to=${dateTo}`, [dateFrom, dateTo]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch<AnalyticsReport>(`/api/reports/analytics/?${query}`)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [query]);

  const kpis = data?.kpis;
  const baseCurr = data?.base_currency_code || "INR";
  const companyName = activeOrganization?.name || "Ananta Graphics";

  const exportOptions = useMemo(() => {
    return {
      companyName,
      logoUrl: getReportLogo(
        activeOrganization?.name,
        activeOrganization?.report_logo,
        activeOrganization?.logo
      ),
      watermarkLogoUrl: getBrandLogo(
        activeOrganization?.name,
        activeOrganization?.logo
      ),
      primaryColor: activeOrganization?.primary_color || "#C31432",
    };
  }, [activeOrganization, companyName]);

  async function handleReportExport(format: ExportFormat, specificReportType?: "overview" | "clients" | "products" | "pipeline") {
    if (!data) return;
    const repType = specificReportType || (activeTab as any) || "overview";
    if (format === "csv") {
      const baseUrl = getApiBaseUrl();
      const prefix = getOrgPrefix(companyName);
      try {
        const res = await fetch(`${baseUrl}/api/reports/export/?${query}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to export report");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${prefix}${repType}_report_${baseCurr}_${dateFrom}_to_${dateTo}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch {
        window.open(`${baseUrl}/api/reports/export/?${query}`, "_blank");
      }
    } else {
      await exportAnalyticsReport(format, data, companyName, {
        ...exportOptions,
        reportType: repType,
      });
    }
  }

  // Filtered Client List
  const filteredClients = useMemo(() => {
    if (!data?.top_clients) return [];
    if (!clientSearch.trim()) return data.top_clients;
    const q = clientSearch.toLowerCase();
    return data.top_clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.company_name && c.company_name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [data?.top_clients, clientSearch]);

  // Filtered Product List
  const filteredProducts = useMemo(() => {
    if (!data?.top_products) return [];
    if (!productSearch.trim()) return data.top_products;
    const q = productSearch.toLowerCase();
    return data.top_products.filter((p) => p.name.toLowerCase().includes(q));
  }, [data?.top_products, productSearch]);

  return (
    <div className="flex flex-col gap-6">
      {/* Controls & Date Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs font-bold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-md border border-primary-100 shadow-2xs">
            Base Currency: {baseCurr}
          </span>
          <p className="text-xs font-medium text-ink-muted hidden md:inline">
            Financial intelligence, margins & performance
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DatePresets
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChange={(from, to) => {
              setDateFrom(from);
              setDateTo(to);
            }}
          />

          <ExportDropdown
            disabled={!data || loading}
            onExport={(fmt) => handleReportExport(fmt, activeTab as any)}
            buttonText="Export Report"
            filename={`financial_report_${baseCurr}_${dateFrom}_to_${dateTo}`}
            title="Financial Analytics Report"
          />
        </div>
      </div>

      {loading && !data ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingState size="lg" label="Generating Financial Analytics..." sublabel="Calculating KPIs & breakdown across dates" />
        </div>
      ) : (
        <>
          {/* Top KPI Summary Banner */}
          {kpis && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">Total Revenue ({baseCurr})</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-extrabold text-ink font-mono">{formatCurrency(kpis.total_revenue, baseCurr)}</div>
                <div className="mt-2 flex items-center gap-1.5 text-[12px]">
                  {kpis.revenue_growth >= 0 ? (
                    <span className="flex items-center gap-0.5 font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                      <TrendingUp className="h-3 w-3" /> +{kpis.revenue_growth}%
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md">
                      <TrendingDown className="h-3 w-3" /> {kpis.revenue_growth}%
                    </span>
                  )}
                  <span className="text-ink-muted">vs previous period</span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">Collections Status</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Wallet className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-extrabold text-emerald-600 font-mono">{formatCurrency(kpis.paid_revenue, baseCurr)}</div>
                <div className="mt-2 flex items-center justify-between text-[12px] text-ink-muted">
                  <span>Pending: <span className="font-semibold text-rose-600 font-mono">{formatCurrency(kpis.pending_revenue, baseCurr)}</span></span>
                  <span className="font-mono font-bold text-ink">
                    {kpis.total_revenue > 0 ? `${((kpis.paid_revenue / kpis.total_revenue) * 100).toFixed(0)}%` : "0%"}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">Orders & Volume</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-extrabold text-ink font-mono">{kpis.total_orders.toLocaleString("en-IN")}</div>
                <div className="mt-2 flex items-center justify-between text-[12px] text-ink-muted">
                  <span>Avg Order Value (AOV):</span>
                  <span className="font-mono font-bold text-ink">{formatCurrency(kpis.avg_order_value, baseCurr)}</span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">Quotation Win Rate</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                    <Percent className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-extrabold text-purple-600 font-mono">
                  {data?.quotation_funnel ? `${data.quotation_funnel.conversion_rate}%` : "0%"}
                </div>
                <div className="mt-2 flex items-center justify-between text-[12px] text-ink-muted">
                  <span>Accepted: <span className="font-semibold text-ink font-mono">{data?.quotation_funnel.accepted}</span></span>
                  <span>Sent: <span className="font-semibold text-ink font-mono">{data?.quotation_funnel.sent}</span></span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="border-b border-border">
            <div className="flex gap-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={clsx(
                    "pb-3 text-[14px] font-bold transition-all border-b-2 -mb-px px-3",
                    activeTab === t.key
                      ? "border-primary-500 text-primary-600"
                      : "border-transparent text-ink-muted hover:text-ink"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab 1: Overview & Trends */}
          {activeTab === "overview" && data && (
            <div className="flex flex-col gap-6">
              <Card className="p-5">
                <div className="mb-4">
                  <h3 className="text-[16px] font-extrabold text-ink">Revenue Trajectory & Order Counts</h3>
                  <p className="text-[12.5px] text-ink-muted">Interactive trend breakdown in {baseCurr} over {data.date_from} to {data.date_to}</p>
                </div>
                <AreaTrendChart data={data.trend} height={260} currencyCode={baseCurr} />
              </Card>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card className="p-5">
                  <DonutChart data={data.payment_breakdown} title="Payment Collections Status" size={170} thickness={22} currencyCode={baseCurr} />
                </Card>

                <Card className="p-5">
                  <DonutChart
                    data={data.delivery_breakdown}
                    title="Order Fulfillment & Delivery Status"
                    valueType="count"
                    size={170}
                    thickness={22}
                  />
                </Card>
              </div>
            </div>
          )}

          {/* Tab 2: Client-Wise Report */}
          {activeTab === "clients" && data && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface-sunken/40 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-ink">Client-Wise Revenue & Collections Report</h3>
                    <p className="text-xs text-ink-muted">Complete breakdown of all client accounts in {baseCurr}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint" />
                    <input
                      type="text"
                      placeholder="Filter clients..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 w-48 sm:w-60"
                    />
                  </div>
                  <ExportDropdown
                    disabled={!data || loading}
                    onExport={(fmt) => handleReportExport(fmt, "clients")}
                    buttonText="Export Client Report"
                    filename={`client_wise_report_${baseCurr}_${dateFrom}_to_${dateTo}`}
                    title="Client-Wise Sales Report"
                    variant="outline"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className="p-5 lg:col-span-1">
                  <h3 className="mb-4 text-[15px] font-bold text-ink">Top Revenue Contributors</h3>
                  <ProgressBarList
                    items={(data.top_clients || []).slice(0, 8).map((c) => ({
                      name: c.name,
                      value: c.revenue,
                      subValue: `${c.order_count} orders`,
                      share_pct: c.share_pct,
                    }))}
                    currencyCode={baseCurr}
                    barColor="#2563eb"
                  />
                </Card>

                <Card className="p-5 lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[15px] font-bold text-ink">
                      Client Performance Ledger ({filteredClients.length} Accounts)
                    </h3>
                  </div>

                  {filteredClients.length === 0 ? (
                    <p className="py-8 text-center text-sm text-ink-faint">No client accounts match your search.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-border bg-surface-sunken/50 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                            <th className="px-3 py-2.5">Client Name</th>
                            <th className="px-3 py-2.5">Company</th>
                            <th className="px-3 py-2.5 text-center">Orders</th>
                            <th className="px-3 py-2.5 text-right">Total Revenue ({baseCurr})</th>
                            <th className="px-3 py-2.5 text-right">Paid Amount</th>
                            <th className="px-3 py-2.5 text-right">Balance Due</th>
                            <th className="px-3 py-2.5 text-right">Share %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {filteredClients.map((c, i) => (
                            <tr key={i} className="hover:bg-surface-hover/50 transition-colors">
                              <td className="px-3 py-3 font-semibold text-ink">
                                <div>{c.name}</div>
                                {c.phone && <div className="text-[11px] text-ink-faint font-normal">{c.phone}</div>}
                              </td>
                              <td className="px-3 py-3 text-ink-muted text-xs">{c.company_name || "—"}</td>
                              <td className="px-3 py-3 text-center font-mono text-ink-muted">{c.order_count}</td>
                              <td className="px-3 py-3 text-right font-mono font-bold text-ink">{formatCurrency(c.revenue, baseCurr)}</td>
                              <td className="px-3 py-3 text-right font-mono text-emerald-600 font-semibold">{formatCurrency(c.paid_revenue ?? 0, baseCurr)}</td>
                              <td className="px-3 py-3 text-right font-mono text-rose-600 font-semibold">{formatCurrency(c.pending_revenue ?? 0, baseCurr)}</td>
                              <td className="px-3 py-3 text-right font-mono font-semibold text-blue-600">{c.share_pct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {/* Tab 3: Product-Wise Report */}
          {activeTab === "products" && data && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface-sunken/40 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-ink">Product-Wise Sales & Volume Report</h3>
                    <p className="text-xs text-ink-muted">Item-by-item sales performance, quantities sold, and average price</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint" />
                    <input
                      type="text"
                      placeholder="Filter products..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 w-48 sm:w-60"
                    />
                  </div>
                  <ExportDropdown
                    disabled={!data || loading}
                    onExport={(fmt) => handleReportExport(fmt, "products")}
                    buttonText="Export Product Report"
                    filename={`product_wise_report_${baseCurr}_${dateFrom}_to_${dateTo}`}
                    title="Product-Wise Sales Report"
                    variant="outline"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className="p-5 lg:col-span-1">
                  <h3 className="mb-4 text-[15px] font-bold text-ink">Top Products by Revenue</h3>
                  <ProgressBarList
                    items={(data.top_products || []).slice(0, 8).map((p) => ({
                      name: p.name,
                      value: p.revenue,
                      subValue: `${p.qty} units`,
                      share_pct: p.share_pct,
                    }))}
                    currencyCode={baseCurr}
                    barColor="#c31432"
                  />
                </Card>

                <Card className="p-5 lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[15px] font-bold text-ink">
                      Product Sales Breakdown ({filteredProducts.length} Items)
                    </h3>
                  </div>

                  {filteredProducts.length === 0 ? (
                    <p className="py-8 text-center text-sm text-ink-faint">No product sales in this date range.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-border bg-surface-sunken/50 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                            <th className="px-4 py-2.5">Product Name</th>
                            <th className="px-4 py-2.5 text-right">Units Sold</th>
                            <th className="px-4 py-2.5 text-center">Orders Count</th>
                            <th className="px-4 py-2.5 text-right">Total Revenue ({baseCurr})</th>
                            <th className="px-4 py-2.5 text-right">Avg Selling Price</th>
                            <th className="px-4 py-2.5 text-right">Market Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {filteredProducts.map((p, i) => (
                            <tr key={i} className="hover:bg-surface-hover/50 transition-colors">
                              <td className="px-4 py-3 font-semibold text-ink">{p.name}</td>
                              <td className="px-4 py-3 text-right font-mono text-ink-muted">{p.qty.toLocaleString("en-IN")}</td>
                              <td className="px-4 py-3 text-center font-mono text-ink-muted">{p.orders_count ?? "—"}</td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-ink">{formatCurrency(p.revenue, baseCurr)}</td>
                              <td className="px-4 py-3 text-right font-mono text-ink-muted">{formatCurrency(p.avg_price ?? 0, baseCurr)}</td>
                              <td className="px-4 py-3 text-right font-mono font-semibold text-primary-600">{p.share_pct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {/* Tab 4: Pipeline & Margins */}
          {activeTab === "pipeline" && data && (
            <div className="flex flex-col gap-6">
              {/* Quotation Pipeline Conversion */}
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-[16px] font-extrabold text-ink">Quotation Pipeline & Win Conversion</h3>
                    <p className="text-[12.5px] text-ink-muted">Tracking proposal lifecycle from draft to confirmed orders</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-bold text-[13px]">{data.quotation_funnel.conversion_rate}% Conversion Rate</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-lg border border-border bg-surface-sunken/40 p-4">
                    <div className="flex items-center gap-2 text-ink-muted text-xs font-semibold">
                      <Clock className="h-4 w-4 text-slate-500" /> Drafts
                    </div>
                    <div className="mt-2 text-xl font-bold font-mono text-ink">{data.quotation_funnel.draft}</div>
                  </div>

                  <div className="rounded-lg border border-border bg-surface-sunken/40 p-4">
                    <div className="flex items-center gap-2 text-ink-muted text-xs font-semibold">
                      <Send className="h-4 w-4 text-blue-500" /> Sent / Proposals
                    </div>
                    <div className="mt-2 text-xl font-bold font-mono text-ink">{data.quotation_funnel.sent}</div>
                  </div>

                  <div className="rounded-lg border border-border bg-surface-sunken/40 p-4">
                    <div className="flex items-center gap-2 text-ink-muted text-xs font-semibold">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Accepted / Won
                    </div>
                    <div className="mt-2 text-xl font-bold font-mono text-emerald-600">{data.quotation_funnel.accepted}</div>
                  </div>

                  <div className="rounded-lg border border-border bg-surface-sunken/40 p-4">
                    <div className="flex items-center gap-2 text-ink-muted text-xs font-semibold">
                      <XCircle className="h-4 w-4 text-rose-500" /> Rejected
                    </div>
                    <div className="mt-2 text-xl font-bold font-mono text-rose-600">{data.quotation_funnel.rejected}</div>
                  </div>
                </div>
              </Card>

              {/* Costing & Profit Margin Analysis */}
              <Card className="p-5">
                <div className="mb-4">
                  <h3 className="text-[16px] font-extrabold text-ink">Costing & Profit Margin Analysis ({baseCurr})</h3>
                  <p className="text-[12.5px] text-ink-muted">Supplier buy cost vs client selling price margins</p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-border bg-surface-sunken/40 p-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Total Costings</span>
                    <div className="mt-1 font-mono text-lg font-bold text-ink">{data.costing_overview.total_costings}</div>
                  </div>

                  <div className="rounded-lg border border-border bg-surface-sunken/40 p-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Total Supplier Cost</span>
                    <div className="mt-1 font-mono text-lg font-bold text-slate-700">
                      {formatCurrency(data.costing_overview.total_supplier_cost, baseCurr)}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-surface-sunken/40 p-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Estimated Profit</span>
                    <div className="mt-1 font-mono text-lg font-bold text-emerald-600">
                      {formatCurrency(data.costing_overview.total_profit, baseCurr)}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-surface-sunken/40 p-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Avg Profit Margin</span>
                    <div className="mt-1 font-mono text-lg font-bold text-purple-600">
                      {data.costing_overview.avg_margin_percent}%
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
