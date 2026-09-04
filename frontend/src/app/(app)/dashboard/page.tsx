"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  ClipboardList,
  Wallet,
  FolderKanban,
  FileCheck2,
  ArrowRight,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, Paginated } from "@/lib/api";
import { AnalyticsReport, OrderSummary, ProjectSummary } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill, DELIVERY_STATUS_TONE, labelize } from "@/components/ui/StatusPill";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { DatePresets } from "@/components/charts/DatePresets";
import { LoadingState } from "@/components/ui/LoadingState";

interface Notification {
  id: number;
  title: string;
  message: string;
  order?: number | null;
  order_no?: string | null;
  created_at: string;
  is_read: boolean;
}

function getInitialMonth() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);
  return { from, to };
}

export default function DashboardPage() {
  const { user, can } = useAuth();
  const initial = useMemo(() => getInitialMonth(), []);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);

  const [analytics, setAnalytics] = useState<AnalyticsReport | null>(null);
  const router = useRouter();
  const [activeProjects, setActiveProjects] = useState<number | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderSummary[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const canOrders = can("orders", "view");
  const canProjects = can("projects", "view");
  const canReports = can("reports", "view");
  const canNotifications = can("notifications", "view");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const tasks: Promise<void>[] = [];

      if (canReports) {
        tasks.push(
          apiFetch<AnalyticsReport>(`/api/reports/analytics/?date_from=${dateFrom}&date_to=${dateTo}`)
            .then((r) => {
              if (!cancelled) setAnalytics(r);
            })
            .catch(() => {}),
        );
      }
      if (canProjects) {
        tasks.push(
          apiFetch<Paginated<ProjectSummary>>("/api/projects/?status=active")
            .then((r) => {
              if (!cancelled) setActiveProjects(r.count);
            })
            .catch(() => {}),
        );
      }
      if (canOrders) {
        tasks.push(
          apiFetch<Paginated<OrderSummary>>("/api/orders/")
            .then((r) => {
              if (!cancelled) setRecentOrders(r.results.slice(0, 6));
            })
            .catch(() => {}),
        );
      }
      if (canNotifications) {
        tasks.push(
          apiFetch<Paginated<Notification>>("/api/notifications/")
            .then((r) => {
              if (!cancelled) setNotifications(r.results.slice(0, 5));
            })
            .catch(() => {}),
        );
      }

      await Promise.all(tasks);
      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, canOrders, canProjects, canReports, canNotifications]);

  const displayName = user?.first_name || user?.username || "";
  const kpis = analytics?.kpis;
  const baseCurr = analytics?.base_currency_code || "INR";

  if (loading && !analytics && canReports) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <LoadingState
          size="xl"
          label="Preparing Business Dashboard..."
          sublabel="Aggregating sales, revenue & performance KPIs"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Date Range Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Welcome back, {displayName}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {canReports && (
          <DatePresets
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChange={(from, to) => {
              setDateFrom(from);
              setDateTo(to);
            }}
          />
        )}
      </div>

      {/* Primary KPI Metrics Bar */}
      {(canReports || canProjects) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {canReports && kpis && (
            <>
              <div className="relative overflow-hidden rounded-xl border border-border bg-white p-5 shadow-xs transition-all hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">Total Revenue ({baseCurr})</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-extrabold text-ink font-mono">
                  {formatCurrency(kpis.total_revenue, baseCurr)}
                </div>
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

              <div className="relative overflow-hidden rounded-xl border border-border bg-white p-5 shadow-xs transition-all hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">Collections (Paid)</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Wallet className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-extrabold text-ink font-mono">
                  {formatCurrency(kpis.paid_revenue, baseCurr)}
                </div>
                <div className="mt-2 flex items-center justify-between text-[12px] text-ink-muted">
                  <span>Pending: <span className="font-semibold text-primary-600 font-mono">{formatCurrency(kpis.pending_revenue, baseCurr)}</span></span>
                  <span className="font-mono font-bold text-ink">
                    {kpis.total_revenue > 0 ? `${((kpis.paid_revenue / kpis.total_revenue) * 100).toFixed(0)}%` : "0%"}
                  </span>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-border bg-white p-5 shadow-xs transition-all hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">Total Orders</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-extrabold text-ink font-mono">
                  {kpis.total_orders.toLocaleString("en-IN")}
                </div>
                <div className="mt-2 flex items-center justify-between text-[12px] text-ink-muted">
                  <span>Avg Order Value:</span>
                  <span className="font-mono font-bold text-ink">{formatCurrency(kpis.avg_order_value, baseCurr)}</span>
                </div>
              </div>
            </>
          )}

          {canProjects && activeProjects !== null && (
            <div className="relative overflow-hidden rounded-xl border border-border bg-white p-5 shadow-xs transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">Active Projects</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                  <FolderKanban className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-extrabold text-ink font-mono">
                {activeProjects.toLocaleString("en-IN")}
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px] text-ink-muted">
                <span>Quotation Win Rate:</span>
                <span className="font-mono font-bold text-emerald-600">
                  {analytics?.quotation_funnel ? `${analytics.quotation_funnel.conversion_rate}%` : "—"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visual Analytics Row */}
      {canReports && analytics && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Revenue & Volume Area Trend Chart */}
          <Card className="p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-extrabold text-ink">Performance & Revenue Trend ({baseCurr})</h3>
                <p className="text-[12px] text-ink-muted">Interactive daily performance trajectory in {baseCurr}</p>
              </div>
              <Link href="/reports" className="flex items-center gap-1 text-[12.5px] font-semibold text-primary-500 hover:text-primary-600">
                Detailed Analytics <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <AreaTrendChart data={analytics.trend} height={220} currencyCode={baseCurr} />
          </Card>

          {/* Payment & Fulfillment Donut Rings */}
          <Card className="p-5 flex flex-col justify-between">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[15px] font-extrabold text-ink">Collections Breakdown</h3>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">By Payment</span>
              </div>
              <DonutChart data={analytics.payment_breakdown} size={150} thickness={18} currencyCode={baseCurr} />
            </div>

            <div className="mt-4 pt-4 border-t border-border/80 flex items-center justify-between text-[12.5px]">
              <span className="text-ink-muted">Active Clients:</span>
              <span className="font-bold text-ink font-mono">{kpis?.active_clients || 0} accounts</span>
            </div>
          </Card>
        </div>
      )}

      {/* Bottom Grid: Recent Orders & Notifications */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {canOrders && (
          <Card className="lg:col-span-2">
            <CardHeader
              title="Recent Orders"
              action={
                <Link href="/orders" className="text-[13px] font-semibold text-primary-500 hover:text-primary-600">
                  View all orders
                </Link>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-sunken/40 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                    <th className="px-5 py-2.5 font-bold">Order No</th>
                    <th className="px-5 py-2.5 font-bold">Client</th>
                    <th className="px-5 py-2.5 font-bold">Status</th>
                    <th className="px-5 py-2.5 text-right font-bold">Amount</th>
                    <th className="px-5 py-2.5 font-bold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && recentOrders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-ink-faint">
                        No orders in this range.
                      </td>
                    </tr>
                  )}
                  {recentOrders.map((o) => (
                    <tr key={o.id} className="border-b border-border last:border-b-0 hover:bg-surface-hover transition-colors">
                      <td className="px-5 py-3 font-mono text-[13px] font-semibold text-ink">
                        <Link href={`/orders/${o.id}`} className="hover:text-primary-500">
                          {o.order_no}
                        </Link>
                      </td>
                      <td className="px-5 py-3 font-medium text-ink">{o.client_name}</td>
                      <td className="px-5 py-3">
                        <StatusPill label={labelize(o.delivery_status)} tone={DELIVERY_STATUS_TONE[o.delivery_status]} />
                      </td>
                      <td className="tnum px-5 py-3 text-right font-mono font-bold text-ink">{formatCurrency(o.grand_total, o.currency_code || baseCurr)}</td>
                      <td className="px-5 py-3 text-ink-muted text-[13px]">{formatDate(o.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {canNotifications && (
          <Card className="flex flex-col">
            <CardHeader
              title="Notifications"
              action={
                <Link href="/notifications" className="text-[12.5px] font-semibold text-primary-500 hover:text-primary-600">
                  View all
                </Link>
              }
            />
            <div className="flex-1">
              {!loading && notifications.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-ink-faint">You&apos;re all caught up.</p>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (n.order) {
                      router.push(`/orders/${n.order}`);
                      return;
                    }
                    const match = (n.title + " " + (n.message || "")).match(/ORD-\d{4}-\d+/i);
                    if (match) {
                      router.push(`/orders?search=${encodeURIComponent(match[0])}`);
                      return;
                    }
                    const quoteMatch = (n.title + " " + (n.message || "")).match(/QT-\d{4}-\d+|QUO-\d+/i);
                    if (quoteMatch) {
                      router.push(`/quotations?search=${encodeURIComponent(quoteMatch[0])}`);
                      return;
                    }
                  }}
                  className="flex gap-3 border-b border-border px-5 py-3.5 last:border-b-0 hover:bg-surface-hover transition-colors cursor-pointer group"
                >
                  <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${n.is_read ? "bg-border-strong" : "bg-primary-500 ring-4 ring-primary-50"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-ink leading-snug group-hover:text-primary-600 transition-colors">{n.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-[12px] text-ink-muted">{n.message}</p>
                    <p className="mt-1 text-[11px] font-medium text-ink-faint">{formatDate(n.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
