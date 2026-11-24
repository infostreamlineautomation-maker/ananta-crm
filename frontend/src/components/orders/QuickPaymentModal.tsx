"use client";

import { useEffect, useState } from "react";
import { Check, CheckCircle2, CreditCard, RotateCcw, Wallet, Zap } from "lucide-react";
import clsx from "clsx";
import { apiFetch, ApiError } from "@/lib/api";
import { OrderSummary } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

interface QuickPaymentModalProps {
  order: OrderSummary | null;
  onClose: () => void;
  onSuccess: (updated: OrderSummary) => void;
}

export function QuickPaymentModal({ order, onClose, onSuccess }: QuickPaymentModalProps) {
  const toast = useToast();

  const [paymentStatus, setPaymentStatus] = useState<"pending" | "partial" | "paid">("pending");
  const [paidAmount, setPaidAmount] = useState<string>("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setPaymentStatus(
        order.payment_status === "paid" || order.payment_status === "partial"
          ? order.payment_status
          : "pending"
      );
      setPaidAmount(String(order.paid_amount || "0"));
      setError(null);
    }
  }, [order]);

  if (!order) return null;

  const grandTotal = Number(order.grand_total || 0);
  const curr = order.currency_code || "INR";
  const numPaid = Number(paidAmount || 0);
  const newDue = Math.max(0, grandTotal - numPaid);

  function handleSetFullPaid() {
    setPaidAmount(String(grandTotal));
    setPaymentStatus("paid");
  }

  function handleSetPending() {
    setPaidAmount("0");
    setPaymentStatus("pending");
  }

  function handlePaidAmountChange(val: string) {
    setPaidAmount(val);
    const n = Number(val || 0);
    if (n >= grandTotal && grandTotal > 0) {
      setPaymentStatus("paid");
    } else if (n > 0) {
      setPaymentStatus("partial");
    } else {
      setPaymentStatus("pending");
    }
  }

  async function handleQuickFullPayDirect() {
    if (!order) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        payment_status: "paid",
        paid_amount: grandTotal,
      };
      const updated = await apiFetch<OrderSummary>(`/api/orders/${order.id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success(`Project ${order.order_no} marked as Paid (${formatCurrency(grandTotal, curr)}).`);
      onSuccess(updated);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't update payment status.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    setSaving(true);
    setError(null);

    try {
      const finalPaid = paymentStatus === "paid" && numPaid <= 0 ? grandTotal : numPaid;
      const payload = {
        payment_status: paymentStatus,
        paid_amount: finalPaid,
      };

      const updated = await apiFetch<OrderSummary>(`/api/orders/${order.id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      toast.success(`Payment updated for Project ${order.order_no}.`);
      onSuccess(updated);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't update payment status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={`Quick Payment Update — ${order.order_no}`} width="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Project & Client summary card */}
        <div className="rounded-lg border border-border bg-surface-sunken/40 p-3 text-xs">
          <div className="flex items-center justify-between text-ink-muted">
            <span>Project / Job</span>
            <span className="font-mono font-bold text-ink">{order.order_no}</span>
          </div>
          {order.project_title && (
            <div className="mt-1 text-sm font-bold text-ink truncate">
              {order.project_title}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-ink-muted">
            <span>Client</span>
            <span className="font-semibold text-ink truncate max-w-[220px]">
              {order.client_name} {order.company_name ? `(${order.company_name})` : ""}
            </span>
          </div>
        </div>

        {/* 3 KPI Overview Boxes */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-border bg-white p-2.5 shadow-2xs">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
              Total Bill
            </span>
            <p className="mt-1 font-mono text-sm font-extrabold text-ink">
              {formatCurrency(grandTotal, curr)}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-white p-2.5 shadow-2xs">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
              Already Paid
            </span>
            <p className="mt-1 font-mono text-sm font-bold text-emerald-700">
              {formatCurrency(order.paid_amount || 0, curr)}
            </p>
          </div>

          <div
            className={clsx(
              "rounded-lg border p-2.5 shadow-2xs transition-all",
              Number(order.due_amount || 0) > 0.01
                ? "border-rose-200 bg-rose-50/70 text-rose-800"
                : "border-emerald-200 bg-emerald-50/70 text-emerald-800"
            )}
          >
            <span className="text-[10.5px] font-bold uppercase tracking-wider">
              Remaining Due
            </span>
            <p className="mt-1 font-mono text-sm font-extrabold">
              {formatCurrency(order.due_amount || 0, curr)}
            </p>
          </div>
        </div>

        {/* Quick Action One-Click Pill Buttons */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Quick Actions
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleQuickFullPayDirect}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition-all hover:bg-emerald-100 hover:border-emerald-400 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Zap className="h-3.5 w-3.5 text-emerald-600 fill-emerald-600" />
              <span>Mark as Fully Paid</span>
            </button>

            <button
              type="button"
              onClick={handleSetPending}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-ink-muted transition-all hover:bg-surface-sunken hover:text-ink active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5 text-ink-muted" />
              <span>Reset to Pending</span>
            </button>
          </div>
        </div>

        {/* Detailed Form Fields */}
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-sunken/20 p-3.5">
          <Field label="Payment Status">
            <Select
              value={paymentStatus}
              onChange={(e) => {
                const val = e.target.value as "pending" | "partial" | "paid";
                setPaymentStatus(val);
                if (val === "paid" && numPaid <= 0) {
                  setPaidAmount(String(grandTotal));
                } else if (val === "pending") {
                  setPaidAmount("0");
                }
              }}
            >
              <option value="pending">Pending (Unpaid)</option>
              <option value="partial">Partial Payment Received</option>
              <option value="paid">Paid (Fully Cleared)</option>
            </Select>
          </Field>

          <Field
            label="Paid / Received Amount"
            hint={`Total Order Amount: ${formatCurrency(grandTotal, curr)}`}
          >
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-ink-faint">
                {curr === "INR" ? "₹" : curr}
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={paidAmount}
                onChange={(e) => handlePaidAmountChange(e.target.value)}
                className="pl-7 font-mono font-bold text-ink"
              />
            </div>
          </Field>

          {/* Dynamic Balance Preview */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
            <span className="text-ink-muted">New Remaining Due:</span>
            <span
              className={clsx(
                "font-mono font-bold text-[13px]",
                newDue > 0.01 ? "text-rose-600" : "text-emerald-700"
              )}
            >
              {formatCurrency(newDue, curr)}
            </span>
          </div>
        </div>

        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving} className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            <span>Save Payment</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
