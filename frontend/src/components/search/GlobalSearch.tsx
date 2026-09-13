"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FolderKanban,
  Users,
  FileText,
  Package,
  Building2,
  X,
  ArrowRight,
  Sparkles,
  Command,
  Loader2,
  Clock,
  PlusCircle,
  BarChart3,
  Settings,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "@/lib/api";

export interface SearchResultItem {
  type: "order" | "client" | "quotation" | "product" | "company";
  id: number;
  title: string;
  subtitle: string;
  tag?: string;
  url: string;
}

interface QuickSearchResponse {
  query: string;
  total: number;
  results: SearchResultItem[];
  counts: Record<string, number>;
  groups: {
    orders?: SearchResultItem[];
    clients?: SearchResultItem[];
    quotations?: SearchResultItem[];
    products?: SearchResultItem[];
    companies?: SearchResultItem[];
  };
}

const TYPE_CONFIG = {
  order: {
    label: "Orders",
    icon: FolderKanban,
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
    iconColor: "text-blue-600 bg-blue-50",
  },
  client: {
    label: "Clients",
    icon: Users,
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    iconColor: "text-emerald-600 bg-emerald-50",
  },
  quotation: {
    label: "Quotations",
    icon: FileText,
    badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
    iconColor: "text-purple-600 bg-purple-50",
  },
  product: {
    label: "Products",
    icon: Package,
    badgeBg: "bg-amber-50 text-amber-700 border-amber-200",
    iconColor: "text-amber-600 bg-amber-50",
  },
  company: {
    label: "Companies",
    icon: Building2,
    badgeBg: "bg-cyan-50 text-cyan-700 border-cyan-200",
    iconColor: "text-cyan-600 bg-cyan-50",
  },
};

const QUICK_ACTIONS = [
  { label: "Create Order", href: "/orders/new", icon: PlusCircle, group: "Work" },
  { label: "Add Client", href: "/clients", icon: Users, group: "Master Data" },
  { label: "New Quotation", href: "/quotations/new", icon: FileText, group: "Work" },
  { label: "Financial Reports", href: "/reports", icon: BarChart3, group: "Analytics" },
  { label: "Company Settings", href: "/settings", icon: Settings, group: "Admin" },
];

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <span>{text}</span>;

  const parts: { text: string; match: boolean }[] = [];
  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  let cursor = 0;

  while (cursor < text.length) {
    const idx = lower.indexOf(q, cursor);
    if (idx === -1) {
      parts.push({ text: text.slice(cursor), match: false });
      break;
    }
    if (idx > cursor) {
      parts.push({ text: text.slice(cursor, idx), match: false });
    }
    parts.push({ text: text.slice(idx, idx + q.length), match: true });
    cursor = idx + q.length;
  }

  return (
    <span>
      {parts.map((p, i) =>
        p.match ? (
          <mark key={i} className="bg-primary-100 text-primary-900 rounded-xs px-0.5 font-bold">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </span>
  );
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Global Keyboard shortcut listener: Cmd+K or Ctrl+K or '/'
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setCounts({});
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced API Search
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setCounts({});
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch<QuickSearchResponse>(
          `/api/quick-search/?q=${encodeURIComponent(query.trim())}`
        );
        if (!controller.signal.aborted) {
          setResults(data.results || []);
          setCounts(data.counts || {});
          setSelectedIndex(0);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setResults([]);
          setCounts({});
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Filter results by active category tab
  const filteredResults = useMemo(() => {
    if (activeTab === "all") return results;
    return results.filter((r) => r.type === activeTab);
  }, [results, activeTab]);

  const handleSelect = useCallback(
    (item: SearchResultItem) => {
      setOpen(false);
      router.push(item.url);
    },
    [router]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredResults.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredResults[selectedIndex]) {
        handleSelect(filteredResults[selectedIndex]);
      }
    }
  };

  const isMac = typeof window !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const shortcutKey = isMac ? "⌘K" : "Ctrl+K";

  return (
    <>
      {/* Search Input Trigger in Topbar */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative flex h-9.5 w-full max-w-md items-center justify-between rounded-xl border border-border/80 bg-surface-sunken/50 px-3 py-1.5 text-left text-xs font-medium text-ink-muted shadow-2xs transition-all hover:border-primary-400 hover:bg-white hover:text-ink hover:shadow-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer"
        aria-label="Open Universal Quick Search"
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <Search className="h-4 w-4 text-ink-faint transition-colors group-hover:text-primary-600" />
          <span className="truncate text-[13px] text-ink-muted group-hover:text-ink">
            Search orders, clients, quotes, catalog...
          </span>
        </div>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-border bg-white px-1.5 py-0.5 text-[10.5px] font-bold font-mono text-ink-faint shadow-2xs group-hover:border-primary-200 group-hover:text-primary-700">
          {shortcutKey}
        </kbd>
      </button>

      {/* Spotlight Command Palette Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 md:p-20 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-ink-heavy/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
            onClick={() => setOpen(false)}
          />

          {/* Dialog Container */}
          <div
            className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-pop)] animate-in zoom-in-95 duration-150"
            onKeyDown={handleKeyDown}
          >
            {/* Search Input Field Header */}
            <div className="relative flex items-center border-b border-border px-4 py-3.5 bg-white">
              <Search className="h-5 w-5 text-primary-600 flex-none mr-3" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search orders, clients, quotes, catalog, companies..."
                className="h-8 w-full bg-transparent text-sm md:text-base font-semibold text-ink placeholder:text-ink-faint focus:outline-none"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-primary-500 flex-none mr-2" />}
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="rounded-md p-1 text-ink-faint hover:bg-surface-sunken hover:text-ink cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category Filter Pills (When search query exists) */}
            {query.length >= 2 && results.length > 0 && (
              <div className="flex items-center gap-1.5 border-b border-border bg-surface-sunken/40 px-4 py-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={clsx(
                    "rounded-md px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer",
                    activeTab === "all"
                      ? "bg-primary-600 text-white shadow-2xs"
                      : "text-ink-muted hover:bg-surface hover:text-ink"
                  )}
                >
                  All ({results.length})
                </button>
                {Object.entries(counts).map(([type, count]) => {
                  if (count === 0) return null;
                  const cfg = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setActiveTab(type)}
                      className={clsx(
                        "rounded-md px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer",
                        activeTab === type
                          ? "bg-primary-600 text-white shadow-2xs"
                          : "text-ink-muted hover:bg-surface hover:text-ink"
                      )}
                    >
                      {cfg?.label || type} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Results Area */}
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {/* Empty Search Prompt / Quick Navigation Actions */}
              {query.length < 2 && (
                <div className="px-2 py-3">
                  <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                    Quick Navigation & Shortcuts
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {QUICK_ACTIONS.map((action) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.href}
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            router.push(action.href);
                          }}
                          className="flex items-center justify-between rounded-xl p-2.5 text-left transition-all hover:bg-surface-sunken group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600 group-hover:bg-primary-100 transition-colors">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[13px] font-bold text-ink group-hover:text-primary-600 transition-colors">
                                {action.label}
                              </p>
                              <p className="text-[11px] text-ink-faint">{action.group}</p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-ink-faint group-hover:text-ink group-hover:translate-x-0.5 transition-all" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No Results Found */}
              {query.length >= 2 && !loading && filteredResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken text-ink-faint mb-3">
                    <Search className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-ink">No results found for &ldquo;{query}&rdquo;</p>
                  <p className="text-xs text-ink-muted mt-1 max-w-xs">
                    Try searching by order number, client name, quote ID, phone number, or product item code.
                  </p>
                </div>
              )}

              {/* Result List Items */}
              {filteredResults.map((item, idx) => {
                const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.order;
                const Icon = cfg.icon;
                const isSelected = idx === selectedIndex;

                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={clsx(
                      "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-all cursor-pointer",
                      isSelected
                        ? "bg-primary-50 text-primary-900 ring-1 ring-primary-500/20 shadow-2xs"
                        : "hover:bg-surface-sunken text-ink"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={clsx("flex h-9 w-9 flex-none items-center justify-center rounded-lg shadow-2xs", cfg.iconColor)}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13.5px] font-bold text-ink">
                            <HighlightMatch text={item.title} query={query} />
                          </p>
                          {item.tag && (
                            <span className={clsx("rounded-md px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider border", cfg.badgeBg)}>
                              {item.tag}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-ink-muted">
                          <HighlightMatch text={item.subtitle} query={query} />
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-none">
                      <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider hidden sm:inline">
                        {cfg.label}
                      </span>
                      <ArrowRight className={clsx("h-4 w-4 transition-transform", isSelected ? "text-primary-600 translate-x-0.5" : "text-ink-faint")} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Shortcut Hints */}
            <div className="flex items-center justify-between border-t border-border bg-surface-sunken/60 px-4 py-2 text-[11px] font-medium text-ink-muted">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded border border-border bg-white px-1 font-mono text-[10px]">↑</kbd>
                  <kbd className="rounded border border-border bg-white px-1 font-mono text-[10px]">↓</kbd> Navigate
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded border border-border bg-white px-1 font-mono text-[10px]">↵</kbd> Select
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded border border-border bg-white px-1 font-mono text-[10px]">ESC</kbd> Close
                </span>
              </div>
              <div className="flex items-center gap-1 text-primary-600 font-bold">
                <Sparkles className="h-3 w-3" />
                <span>Instant CRM Search</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
