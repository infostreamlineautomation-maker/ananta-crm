"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import clsx from "clsx";
import { apiFetch, Paginated } from "@/lib/api";
import { NotificationEntry } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

const EVENT_TONE: Record<string, string> = {
  order_created: "bg-ink-faint",
  payment_pending: "bg-warning-500",
  payment_received: "bg-success-500",
  delivery_pending: "bg-warning-500",
  delivery_in_process: "bg-info-500",
};

function dateGroup(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return "Earlier";
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  async function load() {
    try {
      const res = await apiFetch<Paginated<NotificationEntry>>("/api/notifications/?page_size=100");
      setNotifications(res.results.filter((n) => !n.is_dismissed));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(n: NotificationEntry) {
    if (n.is_read) return;
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    try {
      await apiFetch(`/api/notifications/${n.id}/read/`, { method: "POST" });
    } catch {}
  }

  function handleNotificationClick(n: NotificationEntry) {
    markRead(n);
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
  }

  async function dismiss(n: NotificationEntry) {
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    try {
      await apiFetch(`/api/notifications/${n.id}/dismiss/`, { method: "POST" });
    } catch {}
  }

  const visible = filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications;
  const groups = ["Today", "Yesterday", "Earlier"].map((label) => ({
    label,
    items: visible.filter((n) => dateGroup(n.created_at) === label),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Notifications"
        action={
          <div className="flex rounded-md border border-border bg-white p-0.5">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  "rounded px-3 py-1.5 text-[13px] font-semibold capitalize transition-colors",
                  filter === f ? "bg-primary-500 text-white" : "text-ink-muted hover:text-ink",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        }
      />

      {!loading && visible.length === 0 && <Card className="px-5 py-16 text-center text-sm text-ink-faint">You&apos;re all caught up.</Card>}

      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint">{group.label}</p>
          <Card className="divide-y divide-border overflow-hidden">
            {group.items.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleNotificationClick(n)}
                className={clsx(
                  "group flex cursor-pointer items-center justify-between gap-3 px-5 py-3.5 transition-all hover:bg-surface-hover",
                  !n.is_read && "border-l-4 border-primary-500 bg-primary-50/20"
                )}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span className={clsx("mt-1.5 h-2 w-2 flex-none rounded-full", EVENT_TONE[n.event_type] || "bg-ink-faint")} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold text-ink group-hover:text-primary-600 transition-colors">
                      {n.title}
                    </p>
                    {n.message && <p className="text-[13px] text-ink-muted mt-0.5">{n.message}</p>}
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-faint">
                      {n.order_no && (
                        <span className="font-mono font-bold text-primary-600 bg-primary-50 px-1.5 py-0.2 rounded border border-primary-100">
                          {n.order_no}
                        </span>
                      )}
                      <span>{new Date(n.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-none pl-2">
                  <span className="hidden sm:inline-flex text-xs font-semibold text-primary-600 group-hover:translate-x-0.5 transition-transform items-center gap-1">
                    View Details <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss(n);
                    }}
                    className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-ink-faint hover:bg-surface-sunken hover:text-ink-muted transition-colors"
                    title="Dismiss"
                    aria-label="Dismiss notification"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}
