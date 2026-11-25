"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import clsx from "clsx";
import { apiFetch, Paginated } from "@/lib/api";
import { Client, Company, Product, ProjectSummary, Supplier } from "@/lib/types";
import { FilterSuggestion } from "@/lib/useDynamicColumnFilters";

type EntityKind = "clients" | "companies" | "suppliers" | "products" | "projects" | "contacts" | "project_titles";

const CACHE_TTL_MS = 30_000;
const entityCache = new Map<EntityKind, { items: FilterSuggestion[]; ts: number }>();
const inflightRequests = new Map<EntityKind, Promise<FilterSuggestion[]>>();

export function getSuggestionKind(columnKey: string, columnLabel?: string): EntityKind | null {
  const key = columnKey.toLowerCase().trim();
  const label = (columnLabel || "").toLowerCase().trim();

  if (key === "client" || key === "client_name") return "clients";
  if (key === "company" || key === "company_name") return "companies";
  if (key === "supplier" || key === "supplier_name") return "suppliers";
  if (key === "product" || key === "product_name" || key === "products") return "products";
  if (key === "project" || key === "project_name") return "projects";
  if (key === "project_title") return "project_titles";
  if (key === "contact_name") return "contacts";
  if (key === "name" && label.includes("project")) return "projects";
  return null;
}

function dedupeSuggestions(items: FilterSuggestion[], preserveSublabelDuplicates = false): FilterSuggestion[] {
  const seen = new Set<string>();
  const result: FilterSuggestion[] = [];
  for (const item of items) {
    const val = item.value.trim();
    if (!val) continue;
    const dedupeKey = preserveSublabelDuplicates
      ? `${val.toLowerCase()}::${(item.sublabel || "").toLowerCase()}`
      : val.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push({ ...item, value: val, label: item.label.trim() });
  }
  return result;
}

async function fetchEntitySuggestions(kind: EntityKind): Promise<FilterSuggestion[]> {
  const cached = entityCache.get(kind);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.items;
  }
  const existing = inflightRequests.get(kind);
  if (existing) return existing;

  const promise = (async () => {
    try {
      let items: FilterSuggestion[] = [];
      if (kind === "clients") {
        const res = await apiFetch<Client[] | Paginated<Client>>("/api/clients/?page_size=300");
        const list = Array.isArray(res) ? res : res.results || [];
        items = dedupeSuggestions(
          list.map((c) => ({
            value: c.client_name,
            label: c.client_name,
            sublabel: c.company_name || undefined,
          })),
          true
        );
      } else if (kind === "companies") {
        const res = await apiFetch<Company[] | Paginated<Company>>("/api/companies/?page_size=300");
        const list = Array.isArray(res) ? res : res.results || [];
        items = dedupeSuggestions(
          list.map((c) => ({
            value: c.company_name,
            label: c.company_name,
            sublabel: c.contact_name || c.city || undefined,
          }))
        );
      } else if (kind === "suppliers") {
        const res = await apiFetch<Supplier[] | Paginated<Supplier>>("/api/suppliers/?page_size=300");
        const list = Array.isArray(res) ? res : res.results || [];
        items = dedupeSuggestions(
          list.map((s) => ({
            value: s.supplier_name,
            label: s.supplier_name,
            sublabel: s.company_name || (s.rating ? `Grade ${s.rating}` : undefined),
          }))
        );
      } else if (kind === "products") {
        const res = await apiFetch<Product[] | Paginated<Product>>("/api/products/?page_size=500");
        const list = Array.isArray(res) ? res : res.results || [];
        items = dedupeSuggestions(
          list.map((p) => ({
            value: p.product_name,
            label: p.product_name,
          }))
        );
      } else if (kind === "projects") {
        const res = await apiFetch<ProjectSummary[] | Paginated<ProjectSummary>>("/api/projects/?page_size=300");
        const list = Array.isArray(res) ? res : res.results || [];
        items = dedupeSuggestions(
          list.map((p) => ({
            value: p.name,
            label: p.name,
            sublabel: p.company_name ? `${p.client_name} (${p.company_name})` : p.client_name || undefined,
          }))
        );
      } else if (kind === "contacts") {
        const res = await apiFetch<Company[] | Paginated<Company>>("/api/companies/?page_size=300");
        const list = Array.isArray(res) ? res : res.results || [];
        items = dedupeSuggestions(
          list
            .filter((c) => Boolean(c.contact_name))
            .map((c) => ({
              value: c.contact_name,
              label: c.contact_name,
              sublabel: c.company_name || undefined,
            })),
          true
        );
      } else if (kind === "project_titles") {
        const res = await apiFetch<Array<{ project_title?: string; client_name?: string; company_name?: string | null }> | Paginated<{ project_title?: string; client_name?: string; company_name?: string | null }>>("/api/orders/?page_size=200");
        const list = Array.isArray(res) ? res : res.results || [];
        items = dedupeSuggestions(
          list
            .filter((o) => Boolean(o.project_title))
            .map((o) => ({
              value: o.project_title || "",
              label: o.project_title || "",
              sublabel: o.company_name ? `${o.client_name} (${o.company_name})` : o.client_name || undefined,
            }))
        );
      }
      entityCache.set(kind, { items, ts: Date.now() });
      return items;
    } catch {
      return [];
    } finally {
      inflightRequests.delete(kind);
    }
  })();

  inflightRequests.set(kind, promise);
  return promise;
}

export interface TextFilterAutocompleteProps {
  columnKey: string;
  columnLabel: string;
  value: string;
  onChange: (val: string) => void;
  onSelectSuggestion: (val: string) => void;
  onEnterSubmit?: () => void;
  suggestions?: FilterSuggestion[];
  placeholder?: string;
  autoFocus?: boolean;
  inputClassName?: string;
  openOnFocusOnly?: boolean;
}

export function TextFilterAutocomplete({
  columnKey,
  columnLabel,
  value,
  onChange,
  onSelectSuggestion,
  onEnterSubmit,
  suggestions: explicitSuggestions,
  placeholder,
  autoFocus,
  inputClassName,
  openOnFocusOnly = false,
}: TextFilterAutocompleteProps) {
  const kind = useMemo(() => getSuggestionKind(columnKey, columnLabel), [columnKey, columnLabel]);
  const [fetchedSuggestions, setFetchedSuggestions] = useState<FilterSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(!openOnFocusOnly && Boolean(autoFocus));
  const [highlightedIdx, setHighlightedIdx] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!kind) return;
    let active = true;
    const cached = entityCache.get(kind);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setFetchedSuggestions(cached.items);
      return;
    }
    setLoading(true);
    fetchEntitySuggestions(kind).then((items) => {
      if (active) {
        setFetchedSuggestions(items);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [kind]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const allSuggestions = useMemo(() => {
    if (explicitSuggestions && explicitSuggestions.length > 0 && fetchedSuggestions.length > 0) {
      return dedupeSuggestions([...fetchedSuggestions, ...explicitSuggestions], kind === "clients");
    }
    if (explicitSuggestions && explicitSuggestions.length > 0) {
      return explicitSuggestions;
    }
    return fetchedSuggestions;
  }, [explicitSuggestions, fetchedSuggestions, kind]);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return allSuggestions.slice(0, 50);
    return allSuggestions
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          (item.sublabel ? item.sublabel.toLowerCase().includes(q) : false) ||
          item.value.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [allSuggestions, value]);

  const hasSuggestionsSupport = Boolean(kind || (explicitSuggestions && explicitSuggestions.length > 0));
  const showDropdown = hasSuggestionsSupport && isFocused && (loading || allSuggestions.length > 0);

  useEffect(() => {
    if (!showDropdown || highlightedIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelectorAll<HTMLElement>("[data-suggestion-item]")[highlightedIdx];
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [highlightedIdx, showDropdown]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      if (filtered.length > 0) {
        e.preventDefault();
        setIsFocused(true);
        setHighlightedIdx((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === "ArrowUp") {
      if (filtered.length > 0) {
        e.preventDefault();
        setIsFocused(true);
        setHighlightedIdx((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showDropdown && highlightedIdx >= 0 && highlightedIdx < filtered.length) {
        const chosen = filtered[highlightedIdx];
        onSelectSuggestion(chosen.value);
        setIsFocused(false);
        setHighlightedIdx(-1);
      } else {
        setIsFocused(false);
        onEnterSubmit?.();
      }
    } else if (e.key === "Escape") {
      if (isFocused) {
        e.stopPropagation();
        setIsFocused(false);
      }
    }
  }

  return (
    <div className="flex flex-col" ref={containerRef}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
        <input
          type="text"
          value={value}
          spellCheck={false}
          autoComplete="off"
          onFocus={() => setIsFocused(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setIsFocused(true);
            setHighlightedIdx(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || `Search ${columnLabel}...`}
          className={
            inputClassName ||
            "h-8 w-full rounded-lg border border-border bg-white pl-8 pr-7 text-xs text-ink placeholder:text-ink-faint focus:border-primary-500 focus:outline-hidden"
          }
          autoFocus={autoFocus}
        />
        {value && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onChange("");
              setHighlightedIdx(-1);
              setIsFocused(true);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink cursor-pointer"
            title="Clear text"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="mt-1.5 rounded-lg border border-border/90 bg-white shadow-sm overflow-hidden animate-in fade-in-50 duration-100">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-faint bg-surface-sunken/60 border-b border-border/60 flex items-center justify-between">
            <span className="text-primary-700 truncate">
              {value.trim() ? `Matching ${columnLabel} (${filtered.length})` : `Select ${columnLabel} (${allSuggestions.length})`}
            </span>
            {loading && <Loader2 className="h-3 w-3 animate-spin text-primary-600 shrink-0" />}
          </div>

          {loading && filtered.length === 0 ? (
            <div className="px-2.5 py-3 text-center text-[11px] text-ink-muted">Loading suggestions...</div>
          ) : filtered.length === 0 ? (
            <div className="px-2.5 py-2.5 text-center text-[11px] text-ink-muted">
              No exact match — press Apply to filter text &ldquo;{value}&rdquo;
            </div>
          ) : (
            <div ref={listRef} className="max-h-40 overflow-y-auto p-1 space-y-0.5 scrollbar-thin">
              {filtered.map((item, idx) => {
                const isHighlighted = idx === highlightedIdx;
                const isSelected = value.trim().toLowerCase() === item.value.toLowerCase();
                return (
                  <button
                    key={`${item.value}::${item.sublabel || ""}::${idx}`}
                    data-suggestion-item
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelectSuggestion(item.value);
                      setIsFocused(false);
                      setHighlightedIdx(-1);
                    }}
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    className={clsx(
                      "w-full flex items-center justify-between gap-2 px-2 py-1.5 text-left rounded-md text-xs transition-colors cursor-pointer",
                      isHighlighted
                        ? "bg-primary-50 text-primary-900 font-semibold"
                        : isSelected
                        ? "bg-primary-50/60 text-primary-800 font-semibold"
                        : "text-ink hover:bg-surface-hover"
                    )}
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
                      <span className="truncate font-medium">{item.label}</span>
                      {item.sublabel && (
                        <span className="text-[10px] font-medium text-ink-muted bg-surface-sunken px-1.5 py-0.5 rounded border border-border/60 truncate max-w-[130px]">
                          {item.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="h-3 w-3 shrink-0 text-primary-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
