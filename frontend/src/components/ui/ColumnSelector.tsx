"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Columns3, RotateCcw } from "lucide-react";
import clsx from "clsx";

export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible?: boolean;
  required?: boolean; // If true, cannot be hidden (e.g. main identifier or action)
}

interface ColumnSelectorProps {
  columns: ColumnDef[];
  visibleColumns: Set<string>;
  onChange: (visible: Set<string>) => void;
  className?: string;
}

export function ColumnSelector({ columns, visibleColumns, onChange, className }: ColumnSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  function toggleColumn(key: string, required?: boolean) {
    if (required) return;
    const next = new Set(visibleColumns);
    if (next.has(key)) {
      if (next.size > 1) {
        next.delete(key);
      }
    } else {
      next.add(key);
    }
    onChange(next);
  }

  function showAll() {
    onChange(new Set(columns.map((c) => c.key)));
  }

  function resetDefault() {
    onChange(new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.key)));
  }

  return (
    <div className={clsx("relative inline-block text-left", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={clsx(
          "flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-xs transition-colors hover:bg-surface-hover",
          open && "border-primary-500 ring-2 ring-primary-100",
        )}
      >
        <Columns3 className="h-3.5 w-3.5 text-ink-muted" />
        <span>Columns</span>
        <span className="rounded-full bg-surface-sunken px-1.5 py-0.2 font-mono text-[11px] font-bold text-ink-muted">
          {visibleColumns.size}/{columns.length}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-56 rounded-xl border border-border bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between border-b border-border/80 px-2 py-1.5 text-[12px] font-bold text-ink">
            <span>Customize Columns</span>
            <button
              onClick={resetDefault}
              className="flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:underline"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>

          <div className="my-1 max-h-60 overflow-y-auto py-1">
            {columns.map((col) => {
              const isChecked = visibleColumns.has(col.key);
              return (
                <label
                  key={col.key}
                  className={clsx(
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer",
                    col.required ? "opacity-60 cursor-not-allowed" : "hover:bg-surface-hover",
                    isChecked ? "text-ink" : "text-ink-muted",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={col.required}
                    onChange={() => toggleColumn(col.key, col.required)}
                    className="h-4 w-4 rounded border-border-strong text-primary-600 focus:ring-primary-500 accent-primary-600"
                  />
                  <span className="flex-1 truncate">{col.label}</span>
                  {col.required && <span className="text-[10px] text-ink-faint">(Fixed)</span>}
                </label>
              );
            })}
          </div>

          <div className="border-t border-border/80 pt-1.5">
            <button
              type="button"
              onClick={showAll}
              className="w-full rounded-md px-2 py-1 text-center text-[11.5px] font-semibold text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              Select All Columns
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
