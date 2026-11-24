"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Filter,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  User,
  Users,
  X,
} from "lucide-react";
import clsx from "clsx";
import { DynamicFilterColumn } from "@/lib/useDynamicColumnFilters";

export interface FilterOption {
  value: string;
  label: string;
  tone?: string;
  dotColor?: string;
}

export type FilterType = "select" | "amount_range" | "date_range" | "text" | "boolean";

export interface FilterGroupConfig {
  key: string;
  label: string;
  type?: FilterType;
  icon?: React.ComponentType<{ className?: string }>;
  options?: FilterOption[];
  minPlaceholder?: string;
  maxPlaceholder?: string;
  isCustom?: boolean;
}

export interface FilterBarClient {
  id: number;
  client_name: string;
  company_name?: string | null;
  phone?: string | null;
}

interface FilterBarProps {
  search?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  filters: (FilterGroupConfig | DynamicFilterColumn)[];
  activeFilters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onReset?: () => void;
  actions?: React.ReactNode;
  className?: string;
  clientSuggestions?: FilterBarClient[];
  selectedClient?: FilterBarClient | null;
  onSelectClient?: (client: FilterBarClient | null) => void;
}

export function FilterBar({
  search = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  activeFilters,
  onFilterChange,
  onReset,
  actions,
  className,
  clientSuggestions,
  selectedClient,
  onSelectClient,
}: FilterBarProps) {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [searchFilterText, setSearchFilterText] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [highlightedClientIdx, setHighlightedClientIdx] = useState<number>(-1);

  const filterMenuRef = useRef<HTMLDivElement>(null);
  const addFilterRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Compute matching clients for client disambiguation popup
  const matchingClients: FilterBarClient[] = useMemo(() => {
    if (!clientSuggestions || !search || search.trim().length < 1) return [];
    const q = search.trim().toLowerCase();
    return clientSuggestions
      .filter((c: FilterBarClient) => {
        const nameMatch = c.client_name ? c.client_name.toLowerCase().includes(q) : false;
        const compMatch = c.company_name ? c.company_name.toLowerCase().includes(q) : false;
        const phoneMatch = c.phone ? c.phone.includes(q) : false;
        return nameMatch || compMatch || phoneMatch;
      })
      .slice(0, 8);
  }, [clientSuggestions, search]);

  // Compute how many filters are currently active (grouping range min/max & from/to)
  const activeCount = Object.entries(activeFilters).filter(([k, v]) => {
    if (!v || v.trim() === "") return false;
    return true;
  }).length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false);
      }
      if (addFilterRef.current && !addFilterRef.current.contains(e.target as Node)) {
        setAddFilterOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelectClient(client: FilterBarClient) {
    onSelectClient?.(client);
    setIsSearchFocused(false);
    setHighlightedClientIdx(-1);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isSearchFocused || matchingClients.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedClientIdx((prev) => (prev < matchingClients.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedClientIdx((prev) => (prev > 0 ? prev - 1 : matchingClients.length));
    } else if (e.key === "Enter") {
      if (highlightedClientIdx >= 0 && highlightedClientIdx < matchingClients.length) {
        e.preventDefault();
        handleSelectClient(matchingClients[highlightedClientIdx]);
      } else {
        // Normal enter key submits standard global search
        setIsSearchFocused(false);
      }
    } else if (e.key === "Escape") {
      setIsSearchFocused(false);
    }
  }

  // Filter columns inside the filter modal if searching
  const filteredConfigList = filters.filter((f) =>
    searchFilterText
      ? f.label.toLowerCase().includes(searchFilterText.toLowerCase()) ||
        f.key.toLowerCase().includes(searchFilterText.toLowerCase())
      : true
  );

  return (
    <div className={clsx("flex flex-col gap-2.5", className)}>
      {/* Primary Toolbar Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input or Selected Client Pill */}
          {selectedClient ? (
            <div className="flex h-9 items-center gap-2 rounded-lg border border-primary-500 bg-primary-50/80 pl-2.5 pr-2 py-1 text-[13px] font-semibold text-primary-950 shadow-xs ring-2 ring-primary-100 max-w-full">
              <User className="h-3.5 w-3.5 text-primary-600 flex-none" />
              <span className="truncate max-w-[220px] sm:max-w-[320px]">
                Client: <strong className="font-bold text-primary-950">{selectedClient.client_name}</strong>
                {selectedClient.company_name && (
                  <span className="text-primary-700 font-normal ml-1">({selectedClient.company_name})</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onSelectClient?.(null)}
                className="ml-auto flex items-center justify-center h-5 w-5 rounded-full text-primary-600 hover:text-primary-950 hover:bg-primary-200/60 cursor-pointer transition-colors"
                title="Clear client filter"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            onSearchChange && (
              <div className="relative w-full sm:w-80" ref={searchContainerRef}>
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  spellCheck={false}
                  autoComplete="off"
                  onFocus={() => setIsSearchFocused(true)}
                  onChange={(e) => {
                    onSearchChange(e.target.value);
                    setIsSearchFocused(true);
                    setHighlightedClientIdx(-1);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={searchPlaceholder}
                  className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-8 text-[13px] text-ink placeholder:text-ink-faint shadow-xs transition-colors focus:border-primary-500 focus:outline-hidden focus:ring-2 focus:ring-primary-100"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      onSearchChange("");
                      setIsSearchFocused(false);
                    }}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-faint hover:text-ink cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Client disambiguation listbox dropdown */}
                {isSearchFocused && search.trim().length >= 1 && matchingClients.length > 0 && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-80 sm:w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border/90 bg-white p-2 shadow-2xl ring-1 ring-black/5 animate-in fade-in-50 slide-in-from-top-1">
                    <div className="px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint flex items-center justify-between border-b border-border/60 pb-2 mb-1.5">
                      <span className="flex items-center gap-1.5 text-primary-700">
                        <Users className="h-3.5 w-3.5" />
                        Matching Clients ({matchingClients.length})
                      </span>
                      <span className="text-[10px] lowercase text-ink-muted">select to filter client</span>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1 py-0.5">
                      {matchingClients.map((client: FilterBarClient, idx: number) => {
                        const isHighlighted = idx === highlightedClientIdx;
                        return (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => handleSelectClient(client)}
                            onMouseEnter={() => setHighlightedClientIdx(idx)}
                            className={clsx(
                              "w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left rounded-xl transition-all group cursor-pointer",
                              isHighlighted
                                ? "bg-primary-50/90 text-primary-950 border border-primary-200/90 shadow-2xs"
                                : "text-ink hover:bg-surface-hover/80 border border-transparent"
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={clsx("font-bold text-[13px] truncate", isHighlighted ? "text-primary-950" : "text-ink")}>
                                  {client.client_name}
                                </span>
                                {client.company_name && (
                                  <span className="text-[11px] font-medium text-ink-muted bg-surface-sunken/80 px-2 py-0.5 rounded-md border border-border/60 truncate max-w-[160px]">
                                    {client.company_name}
                                  </span>
                                )}
                              </div>
                              {client.phone && (
                                <div className="text-[11px] text-ink-muted mt-0.5 font-mono">
                                  {client.phone}
                                </div>
                              )}
                            </div>
                            <ChevronRight className={clsx("h-4 w-4 flex-none transition-all", isHighlighted ? "text-primary-600 translate-x-0.5" : "text-ink-faint opacity-40 group-hover:opacity-100")} />
                          </button>
                        );
                      })}
                    </div>

                    <div className="border-t border-border/60 mt-1.5 pt-1.5">
                      <button
                        type="button"
                        onClick={() => setIsSearchFocused(false)}
                        className={clsx(
                          "w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold rounded-xl transition-colors cursor-pointer",
                          highlightedClientIdx === matchingClients.length
                            ? "bg-primary-50 text-primary-950 font-bold border border-primary-200"
                            : "text-primary-700 hover:bg-primary-50/70 border border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Search className="h-3.5 w-3.5 text-primary-600 flex-none" />
                          <span className="truncate">Search all orders/projects for &ldquo;{search}&rdquo;</span>
                        </div>
                        <span className="flex-none shrink-0 text-[10px] font-medium font-mono bg-white border border-border px-2 py-0.5 rounded text-ink-muted shadow-2xs">
                          ↵ Enter
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* Unified Filters Tab Button */}
          {filters.length > 0 && (
            <div className="relative inline-block" ref={filterMenuRef}>
              <button
                type="button"
                onClick={() => setFilterMenuOpen((prev) => !prev)}
                className={clsx(
                  "flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition-all shadow-xs cursor-pointer",
                  activeCount > 0
                    ? "border-primary-500 bg-primary-50/90 text-primary-700 ring-2 ring-primary-100"
                    : "border-border bg-white text-ink hover:bg-surface-hover",
                  filterMenuOpen && "border-primary-500 ring-2 ring-primary-100",
                )}
              >
                <SlidersHorizontal className={clsx("h-3.5 w-3.5", activeCount > 0 ? "text-primary-600" : "text-ink-muted")} />
                <span>Filters</span>
                {activeCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white">
                    {activeCount}
                  </span>
                )}
                <ChevronDown
                  className={clsx("h-3.5 w-3.5 text-ink-muted transition-transform", filterMenuOpen && "rotate-180")}
                />
              </button>

              {/* Comprehensive Filter Panel Dropdown */}
              {filterMenuOpen && (
                <div className="absolute left-0 z-40 mt-1.5 w-[360px] sm:w-[500px] rounded-2xl border border-border bg-white p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between border-b border-border/70 pb-3">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-primary-600" />
                      <h4 className="text-[14px] font-bold text-ink">Filter Options</h4>
                      {activeCount > 0 && (
                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-bold text-primary-700">
                          {activeCount} active
                        </span>
                      )}
                    </div>
                    {activeCount > 0 && onReset && (
                      <button
                        type="button"
                        onClick={onReset}
                        className="flex items-center gap-1 text-[12px] font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" /> Reset all
                      </button>
                    )}
                  </div>

                  {/* Filter Search within large lists */}
                  {filters.length > 6 && (
                    <div className="relative mt-2.5 mb-1">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
                      <input
                        type="text"
                        value={searchFilterText}
                        onChange={(e) => setSearchFilterText(e.target.value)}
                        placeholder="Search filter fields..."
                        className="h-7.5 w-full rounded-lg border border-border bg-surface-sunken/40 pl-8 pr-2.5 text-xs text-ink placeholder:text-ink-faint focus:border-primary-500 focus:bg-white focus:outline-hidden"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 py-3 max-h-[380px] overflow-y-auto pr-1">
                    {filteredConfigList.map((fg) => {
                      if (fg.type === "amount_range") {
                        const min = activeFilters[`${fg.key}_min`] || "";
                        const max = activeFilters[`${fg.key}_max`] || "";
                        return (
                          <div key={fg.key} className="sm:col-span-2 rounded-xl border border-border/80 bg-surface-sunken/40 p-3">
                            <label className="flex items-center justify-between text-xs font-bold text-ink">
                              <span className="flex items-center gap-1.5">
                                <DollarSign className="h-3.5 w-3.5 text-primary-600" />
                                {fg.label} Range
                              </span>
                              {fg.isCustom && (
                                <span className="text-[10px] bg-primary-100/70 text-primary-700 font-semibold px-1.5 py-0.5 rounded">
                                  Custom
                                </span>
                              )}
                            </label>
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                type="number"
                                value={min}
                                onChange={(e) => onFilterChange(`${fg.key}_min`, e.target.value)}
                                placeholder="Min amount"
                                className="h-8 flex-1 rounded-lg border border-border bg-white px-2.5 text-xs text-ink focus:border-primary-500 focus:outline-hidden"
                              />
                              <span className="text-xs text-ink-faint">–</span>
                              <input
                                type="number"
                                value={max}
                                onChange={(e) => onFilterChange(`${fg.key}_max`, e.target.value)}
                                placeholder="Max amount"
                                className="h-8 flex-1 rounded-lg border border-border bg-white px-2.5 text-xs text-ink focus:border-primary-500 focus:outline-hidden"
                              />
                            </div>
                          </div>
                        );
                      }

                      if (fg.type === "date_range") {
                        const from = activeFilters[`${fg.key}_from`] || "";
                        const to = activeFilters[`${fg.key}_to`] || "";
                        return (
                          <div key={fg.key} className="sm:col-span-2 rounded-xl border border-border/80 bg-surface-sunken/40 p-3">
                            <label className="flex items-center justify-between text-xs font-bold text-ink">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-primary-600" />
                                {fg.label} Range
                              </span>
                              {fg.isCustom && (
                                <span className="text-[10px] bg-primary-100/70 text-primary-700 font-semibold px-1.5 py-0.5 rounded">
                                  Custom
                                </span>
                              )}
                            </label>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1">
                                <span className="block text-[10px] uppercase font-bold text-ink-muted mb-0.5">From</span>
                                <input
                                  type="date"
                                  value={from}
                                  onChange={(e) => onFilterChange(`${fg.key}_from`, e.target.value)}
                                  className="h-8 w-full rounded-lg border border-border bg-white px-2 text-xs text-ink focus:border-primary-500 focus:outline-hidden"
                                />
                              </div>
                              <div className="flex-1">
                                <span className="block text-[10px] uppercase font-bold text-ink-muted mb-0.5">To</span>
                                <input
                                  type="date"
                                  value={to}
                                  onChange={(e) => onFilterChange(`${fg.key}_to`, e.target.value)}
                                  className="h-8 w-full rounded-lg border border-border bg-white px-2 text-xs text-ink focus:border-primary-500 focus:outline-hidden"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (fg.type === "boolean") {
                        const currentVal = activeFilters[fg.key] || "";
                        return (
                          <div key={fg.key} className="flex flex-col gap-1">
                            <label className="flex items-center justify-between text-xs font-bold text-ink-muted">
                              <span>{fg.label}</span>
                              {fg.isCustom && (
                                <span className="text-[10px] bg-primary-100/70 text-primary-700 font-semibold px-1.5 py-0.5 rounded">
                                  Custom
                                </span>
                              )}
                            </label>
                            <select
                              value={currentVal}
                              onChange={(e) => onFilterChange(fg.key, e.target.value)}
                              className={clsx(
                                "h-8.5 w-full rounded-lg border px-2.5 text-xs font-medium transition-colors focus:border-primary-500 focus:outline-hidden",
                                currentVal
                                  ? "border-primary-400 bg-primary-50/70 font-semibold text-primary-800"
                                  : "border-border bg-white text-ink hover:border-border-strong",
                              )}
                            >
                              <option value="">All</option>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          </div>
                        );
                      }

                      if (fg.type === "text") {
                        const currentVal = activeFilters[fg.key] || "";
                        return (
                          <div key={fg.key} className="flex flex-col gap-1">
                            <label className="flex items-center justify-between text-xs font-bold text-ink-muted">
                              <span>{fg.label}</span>
                              {fg.isCustom && (
                                <span className="text-[10px] bg-primary-100/70 text-primary-700 font-semibold px-1.5 py-0.5 rounded">
                                  Custom
                                </span>
                              )}
                            </label>
                            <input
                              type="text"
                              value={currentVal}
                              onChange={(e) => onFilterChange(fg.key, e.target.value)}
                              placeholder={`Filter ${fg.label}...`}
                              className={clsx(
                                "h-8.5 w-full rounded-lg border px-2.5 text-xs font-medium transition-colors focus:border-primary-500 focus:outline-hidden",
                                currentVal
                                  ? "border-primary-400 bg-primary-50/70 font-semibold text-primary-800"
                                  : "border-border bg-white text-ink hover:border-border-strong",
                              )}
                            />
                          </div>
                        );
                      }

                      // Standard Select Filter inside Panel
                      const currentVal = activeFilters[fg.key] || "";
                      return (
                        <div key={fg.key} className="flex flex-col gap-1">
                          <label className="flex items-center justify-between text-xs font-bold text-ink-muted">
                            <span className="truncate">{fg.label}</span>
                            {fg.isCustom && (
                              <span className="text-[10px] bg-primary-100/70 text-primary-700 font-semibold px-1.5 py-0.5 rounded">
                                Custom
                              </span>
                            )}
                          </label>
                          <select
                            value={currentVal}
                            onChange={(e) => onFilterChange(fg.key, e.target.value)}
                            className={clsx(
                              "h-8.5 w-full rounded-lg border px-2.5 text-xs font-medium transition-colors focus:border-primary-500 focus:outline-hidden",
                              currentVal
                                ? "border-primary-400 bg-primary-50/70 font-semibold text-primary-800"
                                : "border-border bg-white text-ink hover:border-border-strong",
                            )}
                          >
                            <option value="">All {fg.label}s</option>
                            {(fg.options || []).map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-3">
                    <button
                      type="button"
                      onClick={() => setFilterMenuOpen(false)}
                      className="rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-primary-700 transition-colors shadow-2xs cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeCount > 0 && onReset && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" /> Clear ({activeCount})
            </button>
          )}
        </div>

        {/* Right side actions (e.g. Columns Selector, Add Button) */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Active Filter Chips Row */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mr-1">Active:</span>

          {filters.map((fg) => {
            if (fg.type === "amount_range") {
              const min = activeFilters[`${fg.key}_min`];
              const max = activeFilters[`${fg.key}_max`];
              if (!min && !max) return null;

              let label = "";
              if (min && max) label = `${min} – ${max}`;
              else if (min) label = `≥ ${min}`;
              else if (max) label = `≤ ${max}`;

              return (
                <span
                  key={fg.key}
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50/80 px-2.5 py-0.5 text-[12px] font-semibold text-primary-700 shadow-2xs"
                >
                  <span className="text-primary-600/70">{fg.label}:</span>
                  <span>{label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      onFilterChange(`${fg.key}_min`, "");
                      onFilterChange(`${fg.key}_max`, "");
                    }}
                    className="ml-0.5 rounded p-0.5 hover:bg-primary-200/60 text-primary-700 transition-colors cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            }

            if (fg.type === "date_range") {
              const from = activeFilters[`${fg.key}_from`];
              const to = activeFilters[`${fg.key}_to`];
              if (!from && !to) return null;

              let label = "";
              if (from && to) label = `${from} to ${to}`;
              else if (from) label = `From ${from}`;
              else if (to) label = `Until ${to}`;

              return (
                <span
                  key={fg.key}
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50/80 px-2.5 py-0.5 text-[12px] font-semibold text-primary-700 shadow-2xs"
                >
                  <span className="text-primary-600/70">{fg.label}:</span>
                  <span>{label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      onFilterChange(`${fg.key}_from`, "");
                      onFilterChange(`${fg.key}_to`, "");
                    }}
                    className="ml-0.5 rounded p-0.5 hover:bg-primary-200/60 text-primary-700 transition-colors cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            }

            const val = activeFilters[fg.key];
            if (!val) return null;
            let displayVal = val;
            if (fg.type === "boolean") {
              displayVal = val === "true" ? "Yes" : "No";
            } else {
              const opt = fg.options?.find((o) => o.value === val);
              if (opt) displayVal = opt.label;
            }

            return (
              <span
                key={fg.key}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50/80 px-2.5 py-0.5 text-[12px] font-semibold text-primary-700 shadow-2xs"
              >
                <span className="text-primary-600/70">{fg.label}:</span>
                <span className="truncate max-w-[200px]">{displayVal}</span>
                <button
                  type="button"
                  onClick={() => onFilterChange(fg.key, "")}
                  className="ml-0.5 rounded p-0.5 hover:bg-primary-200/60 text-primary-700 transition-colors cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
