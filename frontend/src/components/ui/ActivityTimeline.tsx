"use client";

import { useEffect, useState } from "react";
import {
  Package,
  Truck,
  Wallet,
  Pencil,
  Mail,
  MessageSquare,
  Clock,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "@/lib/api";
import { TimelineEvent } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Card } from "@/components/ui/Card";

interface ActivityTimelineProps {
  endpoint: string;
  title?: string;
  refreshTrigger?: any;
  className?: string;
}

function getRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 7) return `${diffDay}d ago`;
    return formatDate(dateString);
  } catch {
    return formatDate(dateString);
  }
}

function getEventConfig(eventType: string) {
  switch (eventType) {
    case "created":
      return {
        icon: Package,
        color: "text-blue-600 bg-blue-50 border-blue-200 ring-blue-50",
        badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "delivery_changed":
      return {
        icon: Truck,
        color: "text-teal-600 bg-teal-50 border-teal-200 ring-teal-50",
        badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
      };
    case "payment_updated":
      return {
        icon: Wallet,
        color: "text-emerald-600 bg-emerald-50 border-emerald-200 ring-emerald-50",
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "amount_updated":
      return {
        icon: Sparkles,
        color: "text-amber-600 bg-amber-50 border-amber-200 ring-amber-50",
        badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
      };
    case "comm_email":
      return {
        icon: Mail,
        color: "text-indigo-600 bg-indigo-50 border-indigo-200 ring-indigo-50",
        badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
      };
    case "comm_whatsapp":
      return {
        icon: MessageSquare,
        color: "text-emerald-600 bg-emerald-50 border-emerald-200 ring-emerald-50",
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    default:
      return {
        icon: Pencil,
        color: "text-slate-600 bg-slate-50 border-slate-200 ring-slate-50",
        badgeColor: "bg-slate-50 text-slate-700 border-slate-200",
      };
  }
}

export function ActivityTimeline({
  endpoint,
  title = "Order History & Activity Timeline",
  refreshTrigger,
  className = "",
}: ActivityTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTimeline = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const data: any = await apiFetch<any>(endpoint);
      const rawList: any[] = Array.isArray(data) ? data : (data?.results || []);
      const normalized: TimelineEvent[] = rawList.map((item, idx) => ({
        id: String(item.id || idx),
        event_type: item.event_type || item.action || "updated",
        title: item.title || (item.action ? item.action.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) : "Activity"),
        description: item.description || item.details || "",
        user_name: item.user_name || item.user_full_name || "System",
        created_at: item.created_at,
        source: item.source || "activity",
      }));
      setEvents(normalized);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (endpoint) {
      loadTimeline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, refreshTrigger]);

  return (
    <Card className={clsx("overflow-hidden border border-border bg-white shadow-xs", className)}>
      <div className="flex items-center justify-between border-b border-border bg-surface-sunken/40 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary-600" />
          <h3 className="text-[14px] font-bold text-ink">{title}</h3>
          <span className="ml-1 rounded-full bg-surface-sunken px-2 py-0.5 font-mono text-[11px] font-bold text-ink-muted">
            {events.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => loadTimeline(true)}
          disabled={loading || refreshing}
          className="flex items-center gap-1 text-[12px] font-semibold text-ink-muted hover:text-primary-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={clsx("h-3.5 w-3.5", refreshing && "animate-spin text-primary-500")} />
          Refresh
        </button>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="h-5 w-5 animate-spin text-ink-faint" />
          </div>
        ) : events.length === 0 ? (
          <div className="py-8 text-center text-sm text-ink-faint">
            <ShieldCheck className="mx-auto mb-2 h-7 w-7 text-ink-faint/60" />
            No activity logged for this order yet.
          </div>
        ) : (
          <div className="relative pl-6 before:absolute before:left-[15px] before:top-3 before:bottom-3 before:w-[2px] before:bg-border">
            <div className="flex flex-col gap-6">
              {events.map((e, idx) => {
                const config = getEventConfig(e.event_type);
                const Icon = config.icon;
                const isLatest = idx === 0;

                return (
                  <div key={e.id} className="relative flex items-start gap-4 group">
                    {/* Step Icon Node */}
                    <div
                      className={clsx(
                        "absolute -left-6 mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white shadow-xs transition-transform group-hover:scale-110",
                        config.color,
                        isLatest && "ring-4"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Content Details */}
                    <div className="min-w-0 flex-1 pl-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={clsx("rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider", config.badgeColor)}>
                            {e.title}
                          </span>
                          <span className="text-[13px] font-bold text-ink">{e.user_name || "System"}</span>
                        </div>
                        <span className="text-[12px] font-medium text-ink-muted" title={new Date(e.created_at).toLocaleString("en-IN")}>
                          {getRelativeTime(e.created_at)}
                        </span>
                      </div>

                      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">
                        {e.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
