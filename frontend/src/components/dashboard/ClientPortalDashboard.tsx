"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  FileCheck2,
  FileText,
  Package,
  Printer,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Truck,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { StatusPill, DELIVERY_STATUS_TONE, PAYMENT_STATUS_TONE, labelize } from "@/components/ui/StatusPill";

interface ClientOrder {
  id: number;
  order_no: string;
  date: string;
  project_title?: string;
  product_names?: string;
  delivery_time?: string;
  delivery_status: "pending" | "in_process" | "ready" | "delivered";
  payment_status: "pending" | "advance" | "partial" | "paid";
  subtotal: string | number;
  grand_total: string | number;
  paid_amount?: string | number;
  due_amount?: string | number;
  currency_code?: string;
  description?: string;
}

interface ClientQuotation {
  id: number;
  quotation_no: string;
  quotation_date: string;
  subject?: string;
  status: "draft" | "sent" | "accepted" | "rejected";
  subtotal: string | number;
  currency_code?: string;
}

export function ClientPortalDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [quotations, setQuotations] = useState<ClientQuotation[]>([]);
  const [totals, setTotals] = useState({
    total_grand_total: "0.00",
    total_paid_amount: "0.00",
    total_due_amount: "0.00",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const [ordersRes, quotesRes] = await Promise.all([
          apiFetch<any>("/api/orders/?page_size=100"),
          apiFetch<any>("/api/quotations/?page_size=20"),
        ]);

        if (!cancelled) {
          const ordList: ClientOrder[] = Array.isArray(ordersRes)
            ? ordersRes
            : ordersRes.results || [];
          setOrders(ordList);

          if (ordersRes && typeof ordersRes === "object") {
            setTotals({
              total_grand_total: ordersRes.total_grand_total || "0.00",
              total_paid_amount: ordersRes.total_paid_amount || "0.00",
              total_due_amount: ordersRes.total_due_amount || "0.00",
            });
          }

          const qList: ClientQuotation[] = Array.isArray(quotesRes)
            ? quotesRes
            : quotesRes.results || [];
          setQuotations(qList);
        }
      } catch {
        // Handled silently
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = user?.first_name || user?.username || "Valued Client";
  const clientName = user?.linked_client_name || "My Account";

  // Derive pending payment orders (due_amount > 0)
  const pendingPaymentOrders = orders.filter((o) => {
    const due = Number(o.due_amount ?? 0);
    return due > 0.01;
  });

  // Derive active production orders
  const activeOrders = orders.filter((o) => o.delivery_status !== "delivered");

  // Quotations awaiting review
  const pendingReviewQuotes = quotations.filter(
    (q) => q.status === "sent" || q.status === "draft"
  );

  const totalDueNum = Number(totals.total_due_amount || 0);
  const totalPaidNum = Number(totals.total_paid_amount || 0);
  const totalGrandNum = Number(totals.total_grand_total || 0);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingState
          size="lg"
          label="Loading Client Portal Dashboard..."
          sublabel="Fetching your order tracking, payment balances & active quotations"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Welcome & Account Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-ink tracking-tight">
              Welcome back, {displayName}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Client Portal</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Viewing account statement, active job orders, and payment due statuses for{" "}
            <strong className="text-ink">{clientName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/orders">
            <Button variant="secondary" size="sm" className="gap-1.5 text-xs font-semibold">
              <Package className="h-4 w-4 text-primary-600" />
              <span>My Orders</span>
            </Button>
          </Link>
          <Link href="/quotations">
            <Button variant="primary" size="sm" className="gap-1.5 text-xs font-semibold">
              <FileText className="h-4 w-4" />
              <span>My Quotations</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary Financial Overview KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Pending Due Balance */}
        <div
          className={clsx(
            "relative overflow-hidden rounded-xl border p-5 shadow-xs transition-all",
            totalDueNum > 0
              ? "border-rose-200 bg-rose-50/60 ring-1 ring-rose-500/20"
              : "border-emerald-200 bg-emerald-50/50"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">
              Pending Due Balance
            </span>
            <div
              className={clsx(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                totalDueNum > 0
                  ? "bg-rose-100 text-rose-700"
                  : "bg-emerald-100 text-emerald-700"
              )}
            >
              {totalDueNum > 0 ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
            </div>
          </div>
          <div
            className={clsx(
              "mt-3 text-2xl font-extrabold font-mono",
              totalDueNum > 0 ? "text-rose-700" : "text-emerald-700"
            )}
          >
            {formatCurrency(totalDueNum, "INR")}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-ink-muted">
              {pendingPaymentOrders.length === 1
                ? "1 order with due balance"
                : `${pendingPaymentOrders.length} orders with due balance`}
            </span>
            {totalDueNum > 0 ? (
              <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-[11px]">
                Payment Due
              </span>
            ) : (
              <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                All Clear ✓
              </span>
            )}
          </div>
        </div>

        {/* KPI 2: Total Paid Amount */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">
              Total Amount Paid
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-emerald-700 font-mono">
            {formatCurrency(totalPaidNum, "INR")}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Total payments cleared and recorded to date
          </p>
        </div>

        {/* KPI 3: Total Invoiced Order Value */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">
              Total Order Value
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-ink font-mono">
            {formatCurrency(totalGrandNum, "INR")}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Lifetime orders placed: {orders.length}
          </p>
        </div>

        {/* KPI 4: Active Jobs in Production */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">
              Active Orders
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-blue-700 font-mono">
            {activeOrders.length}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            {activeOrders.length === 1
              ? "1 job currently in production"
              : `${activeOrders.length} jobs in production / delivery`}
          </p>
        </div>
      </div>

      {/* Action Required: Quotations Awaiting Approval */}
      {pendingReviewQuotes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-950">
                  Quotations Awaiting Your Review ({pendingReviewQuotes.length})
                </h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  You have quotations prepared by our team. Please review and confirm to begin production.
                </p>
              </div>
            </div>
            <Link href="/quotations">
              <Button variant="secondary" size="sm" className="gap-1.5 text-xs font-bold text-amber-900 border-amber-300 hover:bg-amber-100">
                <span>Review Quotations</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Main Content Grid: Pending Payments Table + Production Tracking */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Orders with Pending Due Balance */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-surface-sunken/20">
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary-600" />
                  <span>Pending Balances &amp; Due Invoices</span>
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Summary of your unpaid order amounts and target delivery schedules.
                </p>
              </div>
              {pendingPaymentOrders.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                  {pendingPaymentOrders.length} Pending
                </span>
              )}
            </div>

            {pendingPaymentOrders.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-ink text-sm">All Payments Cleared!</h3>
                <p className="text-xs text-ink-muted max-w-sm">
                  You do not have any pending balance on your orders. All accounts are settled.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-bold uppercase tracking-wider text-ink-faint bg-surface-sunken/40">
                      <th className="px-4 py-3">Order #</th>
                      <th className="px-4 py-3">Order Date</th>
                      <th className="px-4 py-3">Due / Delivery Date</th>
                      <th className="px-4 py-3 text-right">Total Amount</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-right text-rose-700">Due Balance</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {pendingPaymentOrders.map((ord) => {
                      const due = Number(ord.due_amount ?? 0);
                      const paid = Number(ord.paid_amount ?? 0);
                      const total = Number(ord.grand_total ?? 0);
                      const curr = ord.currency_code || "INR";

                      return (
                        <tr key={ord.id} className="hover:bg-surface-hover/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-primary-600">
                            <Link href={`/orders/${ord.id}`} className="hover:underline">
                              {ord.order_no}
                            </Link>
                            {ord.project_title && (
                              <div className="text-[11px] text-ink-muted truncate max-w-[150px]">
                                {ord.project_title}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-ink-muted whitespace-nowrap">
                            {formatDate(ord.date)}
                          </td>
                          <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">
                            {ord.delivery_time ? (
                              <span className="flex items-center gap-1 text-ink">
                                <Clock className="h-3 w-3 text-amber-600" />
                                <span>{ord.delivery_time}</span>
                              </span>
                            ) : (
                              <span className="text-ink-faint">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-ink">
                            {formatCurrency(total, curr)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-700">
                            {formatCurrency(paid, curr)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-rose-700">
                            {formatCurrency(due, curr)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusPill
                              label={labelize(ord.payment_status)}
                              tone={PAYMENT_STATUS_TONE[ord.payment_status] || "muted"}
                            />
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <Link
                              href={`/orders/${ord.id}/print`}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 hover:text-primary-700 hover:underline"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span>Invoice</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right Col: Active Production Orders & Delivery Tracking */}
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5 bg-surface-sunken/20">
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-600" />
                <span>Production &amp; Delivery Tracking</span>
              </h2>
              <Link href="/orders" className="text-xs font-semibold text-primary-600 hover:underline">
                All Orders →
              </Link>
            </div>

            <div className="divide-y divide-border/60">
              {activeOrders.length === 0 ? (
                <p className="p-6 text-center text-xs text-ink-faint">
                  No orders currently in production.
                </p>
              ) : (
                activeOrders.slice(0, 5).map((ord) => (
                  <div key={ord.id} className="p-4 flex flex-col gap-2 hover:bg-surface-sunken/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/orders/${ord.id}`}
                        className="font-bold text-xs text-primary-600 hover:underline"
                      >
                        {ord.order_no}
                      </Link>
                      <StatusPill
                        label={labelize(ord.delivery_status)}
                        tone={DELIVERY_STATUS_TONE[ord.delivery_status] || "muted"}
                      />
                    </div>

                    <div className="text-xs text-ink font-medium">
                      {ord.product_names || ord.project_title || ord.description?.slice(0, 40) || "Custom Print Job"}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-ink-muted pt-1">
                      <span>Order Date: {formatDate(ord.date)}</span>
                      {ord.delivery_time && (
                        <span className="font-semibold text-ink flex items-center gap-1">
                          <Clock className="h-3 w-3 text-amber-600" />
                          <span>{ord.delivery_time}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Need Assistance / Support Card */}
          <div className="rounded-xl border border-border bg-surface-sunken/40 p-4 text-xs">
            <h3 className="font-bold text-ink flex items-center gap-1.5 mb-1">
              <span>Need Help with Your Orders?</span>
            </h3>
            <p className="text-ink-muted leading-relaxed">
              For billing queries, proof approvals, or urgent delivery dispatch requests, please contact our support team.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Link href="/companies">
                <Button variant="secondary" size="sm" className="w-full text-xs font-semibold">
                  View Company Profile
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

