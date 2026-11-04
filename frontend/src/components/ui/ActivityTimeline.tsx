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
  ChevronDown,
  ChevronUp,
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
  defaultCollapsed?: boolean;
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
  defaultCollapsed = false,
}: ActivityTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const storageKey = `crm_timeline_collapsed_${title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved !== null) return saved === "true";
      } catch {}
    }
    return defaultCollapsed;
  });

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(storageKey, String(next));
        } catch {}
      }
      return next;
    });
  };

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

  const visibleEvents = showAll ? events : events.slice(0, 5);

  return (
    <Card className={clsx("overflow-hidden border border-border bg-white shadow-xs transition-all", className)}>
      {/* Header bar with Shrink / Expand toggle */}
      <div className="flex items-center justify-between border-b border-border bg-surface-sunken/40 px-5 py-3 select-none">
        <div
          onClick={toggleCollapsed}
          className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition-opacity"
          title={isCollapsed ? "Click to expand timeline" : "Click to shrink timeline"}
        >
          <Clock className="h-4 w-4 text-primary-600 shrink-0" />
          <h3 className="text-[14px] font-bold text-ink">{title}</h3>
          <span className="ml-1 rounded-full bg-surface-sunken px-2 py-0.5 font-mono text-[11px] font-bold text-ink-muted shrink-0">
            {events.length}
          </span>
          {isCollapsed && events.length > 0 && (
            <span className="hidden sm:inline-block text-[11.5px] text-ink-muted truncate max-w-[280px]">
              • Latest {getRelativeTime(events[0].created_at)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              loadTimeline(true);
            }}
            disabled={loading || refreshing}
            className="flex items-center gap-1 text-[12px] font-semibold text-ink-muted hover:text-primary-600 transition-colors disabled:opacity-50 cursor-pointer px-1.5 py-1"
            title="Refresh activities"
          >
            <RefreshCw className={clsx("h-3.5 w-3.5 shrink-0", refreshing && "animate-spin text-primary-500")} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={toggleCollapsed}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1 text-[12px] font-semibold text-ink shadow-2xs hover:bg-neutral-50 hover:border-primary-300 transition-colors cursor-pointer shrink-0"
            title={isCollapsed ? "Expand history timeline" : "Shrink / Collapse history timeline"}
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="h-3.5 w-3.5 text-primary-600 shrink-0" />
                <span>Expand</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                <span>Shrink</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="h-5 w-5 animate-spin text-ink-faint" />
            </div>
          ) : events.length === 0 ? (
            <div className="py-8 text-center text-sm text-ink-faint">
              <ShieldCheck className="mx-auto mb-2 h-7 w-7 text-ink-faint/60" />
              No activity logged yet.
            </div>
          ) : (
            <div>
              <div className="relative pl-6 before:absolute before:left-[15px] before:top-3 before:bottom-3 before:w-[2px] before:bg-border">
                <div className="flex flex-col gap-5">
                  {visibleEvents.map((e, idx) => {
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
                          <Icon className="h-4 w-4 shrink-0" />
                        </div>

                        {/* Content Details */}
                        <div className="min-w-0 flex-1 pl-5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={clsx("rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider shrink-0", config.badgeColor)}>
                                {e.title}
                              </span>
                              <span className="text-[13px] font-bold text-ink">{e.user_name || "System"}</span>
                            </div>
                            <span className="text-[12px] font-medium text-ink-muted shrink-0" title={new Date(e.created_at).toLocaleString("en-IN")}>
                              {getRelativeTime(e.created_at)}
                            </span>
                          </div>

                          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                            {e.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Expand / Show All items toggle if there are more than 5 activities */}
              {events.length > 5 && (
                <div className="mt-5 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-ink-muted">
                    Showing {visibleEvents.length} of {events.length} activities
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAll(!showAll)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:text-primary-600 hover:border-primary-300 hover:bg-surface-hover transition-colors cursor-pointer shadow-2xs"
                  >
                    {showAll ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                        <span>Show recent 5 only</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5 text-primary-600 shrink-0" />
                        <span>Show all {events.length} activities</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
