"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  Check,
  DollarSign,
  Filter,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import clsx from "clsx";
import { DynamicFilterColumn } from "@/lib/useDynamicColumnFilters";

interface ColumnHeaderFilterProps {
  column: DynamicFilterColumn;
  activeFilters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  className?: string;
}

export function ColumnHeaderFilter({
  column,
  activeFilters,
  onFilterChange,
  className,
}: ColumnHeaderFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine current active values based on type
  const minKey = `${column.key}_min`;
  const maxKey = `${column.key}_max`;
  const fromKey = `${column.key}_from`;
  const toKey = `${column.key}_to`;

  const currentVal = activeFilters[column.key] || "";
  const currentMin = activeFilters[minKey] || "";
  const currentMax = activeFilters[maxKey] || "";
  const currentFrom = activeFilters[fromKey] || "";
  const currentTo = activeFilters[toKey] || "";

  const isFiltered =
    Boolean(currentVal) ||
    Boolean(currentMin) ||
    Boolean(currentMax) ||
    Boolean(currentFrom) ||
    Boolean(currentTo);

  // Local draft state when popover is open
  const [draftVal, setDraftVal] = useState(currentVal);
  const [draftMin, setDraftMin] = useState(currentMin);
  const [draftMax, setDraftMax] = useState(currentMax);
  const [draftFrom, setDraftFrom] = useState(currentFrom);
  const [draftTo, setDraftTo] = useState(currentTo);

  // Update floating coordinates relative to viewport
  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = 264;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 16) {
        left = window.innerWidth - popoverWidth - 16;
      }
      if (left < 16) left = 16;

      let top = rect.bottom + 6;
      // If near bottom of viewport, position above the button
      if (top + 320 > window.innerHeight && rect.top > 320) {
        top = Math.max(16, rect.top - 320);
      }

      setPos({ top, left });
    }
  };

  // Sync draft and position when opened or activeFilters change
  useEffect(() => {
    setDraftVal(currentVal);
    setDraftMin(currentMin);
    setDraftMax(currentMax);
    setDraftFrom(currentFrom);
    setDraftTo(currentTo);
    if (isOpen) {
      updatePosition();
    }
  }, [currentVal, currentMin, currentMax, currentFrom, currentTo, isOpen]);

  // Click outside, resize and scroll listeners
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleScrollOrResize() {
      updatePosition();
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  const handleApply = () => {
    if (column.type === "amount_range") {
      onFilterChange(minKey, draftMin);
      onFilterChange(maxKey, draftMax);
    } else if (column.type === "date_range") {
      onFilterChange(fromKey, draftFrom);
      onFilterChange(toKey, draftTo);
    } else {
      onFilterChange(column.key, draftVal);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    if (column.type === "amount_range") {
      onFilterChange(minKey, "");
      onFilterChange(maxKey, "");
      setDraftMin("");
      setDraftMax("");
    } else if (column.type === "date_range") {
      onFilterChange(fromKey, "");
      onFilterChange(toKey, "");
      setDraftFrom("");
      setDraftTo("");
    } else {
      onFilterChange(column.key, "");
      setDraftVal("");
    }
    setIsOpen(false);
  };

  const popoverContent =
    isOpen && mounted && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popoverRef}
            onClick={(e) => e.stopPropagation()}
            style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
            className="fixed z-[9999] w-66 rounded-xl border border-border bg-white p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-100 text-left normal-case tracking-normal font-sans"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/70 pb-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary-600" />
                <span className="text-[12px] font-bold text-ink truncate max-w-[170px]">
                  {column.label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-ink-faint hover:text-ink rounded p-0.5 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Body according to type */}
            <div className="py-1">
              {column.type === "text" && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-ink-muted">Filter text</span>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
                    <input
                      type="text"
                      value={draftVal}
                      onChange={(e) => setDraftVal(e.target.value)}
                      placeholder={`Search ${column.label}...`}
                      onKeyDown={(e) => e.key === "Enter" && handleApply()}
                      className="h-8 w-full rounded-lg border border-border bg-white pl-8 pr-2 text-xs text-ink placeholder:text-ink-faint focus:border-primary-500 focus:outline-hidden"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {column.type === "select" && (
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => setDraftVal("")}
                    className={clsx(
                      "flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium text-left transition-colors cursor-pointer",
                      !draftVal ? "bg-primary-50 text-primary-700 font-bold" : "hover:bg-surface-hover text-ink",
                    )}
                  >
                    <span>All Options</span>
                    {!draftVal && <Check className="h-3.5 w-3.5 text-primary-600" />}
                  </button>
                  {(column.options || []).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDraftVal(opt.value)}
                      className={clsx(
                        "flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium text-left transition-colors cursor-pointer",
                        draftVal === opt.value
                          ? "bg-primary-50 text-primary-700 font-bold"
                          : "hover:bg-surface-hover text-ink",
                      )}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {opt.dotColor && (
                          <span
                            className="h-2 w-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: opt.dotColor }}
                          />
                        )}
                        <span className="truncate">{opt.label}</span>
                      </div>
                      {draftVal === opt.value && <Check className="h-3.5 w-3.5 text-primary-600 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}

              {column.type === "boolean" && (
                <div className="flex flex-col gap-1">
                  {[
                    { value: "", label: "All" },
                    { value: "true", label: "Yes" },
                    { value: "false", label: "No" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDraftVal(opt.value)}
                      className={clsx(
                        "flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium text-left transition-colors cursor-pointer",
                        draftVal === opt.value
                          ? "bg-primary-50 text-primary-700 font-bold"
                          : "hover:bg-surface-hover text-ink",
                      )}
                    >
                      <span>{opt.label}</span>
                      {draftVal === opt.value && <Check className="h-3.5 w-3.5 text-primary-600" />}
                    </button>
                  ))}
                </div>
              )}

              {column.type === "amount_range" && (
                <div className="flex flex-col gap-2">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-muted">
                    <DollarSign className="h-3 w-3 text-primary-600" /> Amount Range
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-ink-faint font-semibold uppercase">Min</span>
                      <input
                        type="number"
                        value={draftMin}
                        onChange={(e) => setDraftMin(e.target.value)}
                        placeholder="Min"
                        className="h-7.5 w-full rounded-md border border-border bg-white px-2 text-xs text-ink focus:border-primary-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-ink-faint font-semibold uppercase">Max</span>
                      <input
                        type="number"
                        value={draftMax}
                        onChange={(e) => setDraftMax(e.target.value)}
                        placeholder="Max"
                        className="h-7.5 w-full rounded-md border border-border bg-white px-2 text-xs text-ink focus:border-primary-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              {column.type === "date_range" && (
                <div className="flex flex-col gap-2">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-muted">
                    <Calendar className="h-3 w-3 text-primary-600" /> Date Range
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <div>
                      <span className="text-[10px] text-ink-faint font-semibold uppercase">From</span>
                      <input
                        type="date"
                        value={draftFrom}
                        onChange={(e) => setDraftFrom(e.target.value)}
                        className="h-7.5 w-full rounded-md border border-border bg-white px-2 text-xs text-ink focus:border-primary-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-ink-faint font-semibold uppercase">To</span>
                      <input
                        type="date"
                        value={draftTo}
                        onChange={(e) => setDraftTo(e.target.value)}
                        className="h-7.5 w-full rounded-md border border-border bg-white px-2 text-xs text-ink focus:border-primary-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between border-t border-border/70 pt-2.5 mt-2.5">
              {isFiltered ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" /> Clear
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-md px-2 py-1 text-[11px] font-semibold text-ink-muted hover:bg-surface-hover cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="rounded-md bg-primary-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-primary-700 shadow-2xs cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={clsx("inline-flex items-center ml-1", className)}>
      <button
        ref={buttonRef}
        type="button"
        title={`Filter by ${column.label}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={clsx(
          "inline-flex h-5 w-5 items-center justify-center rounded transition-all cursor-pointer",
          isFiltered
            ? "bg-primary-600 text-white shadow-2xs ring-2 ring-primary-200"
            : "text-ink-muted/50 hover:bg-surface-sunken hover:text-ink-muted opacity-60 hover:opacity-100",
        )}
      >
        <Filter className="h-3 w-3" />
      </button>

      {popoverContent}
    </div>
  );
}
