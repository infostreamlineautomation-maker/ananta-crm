"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Columns3, GripVertical, RotateCcw } from "lucide-react";
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
  onReorder?: (sourceKey: string, targetKey: string) => void;
  onReset?: () => void;
  className?: string;
}

export function ColumnSelector({
  columns,
  visibleColumns,
  onChange,
  onReorder,
  onReset,
  className,
}: ColumnSelectorProps) {
  const [open, setOpen] = useState(false);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
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

  function handleReset() {
    if (onReset) {
      onReset();
    } else {
      onChange(new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.key)));
    }
  }

  return (
    <div className={clsx("relative inline-block text-left", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={clsx(
          "flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-xs transition-colors hover:bg-surface-hover cursor-pointer",
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
        <div className="absolute right-0 z-40 mt-1.5 w-64 rounded-xl border border-border bg-white p-2.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between border-b border-border/80 px-2 py-1.5 text-[12px] font-bold text-ink">
            <span>Arrange & Toggle Columns</span>
            <button
              onClick={handleReset}
              type="button"
              className="flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:underline cursor-pointer"
              title="Reset order, widths & visibility"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>

          <div className="my-1 max-h-72 overflow-y-auto py-1 divide-y divide-border/40">
            {columns.map((col) => {
              const isChecked = visibleColumns.has(col.key);
              const isDragging = draggedKey === col.key;
              const isOver = dragOverKey === col.key && draggedKey !== col.key;

              return (
                <div
                  key={col.key}
                  draggable={!col.required && !!onReorder}
                  onDragStart={(e) => {
                    if (col.required || !onReorder) return;
                    e.dataTransfer.setData("text/plain", col.key);
                    setDraggedKey(col.key);
                  }}
                  onDragOver={(e) => {
                    if (col.required || !onReorder) return;
                    e.preventDefault();
                    setDragOverKey(col.key);
                  }}
                  onDragLeave={() => setDragOverKey(null)}
                  onDrop={(e) => {
                    if (col.required || !onReorder) return;
                    e.preventDefault();
                    const sourceKey = e.dataTransfer.getData("text/plain");
                    if (sourceKey && sourceKey !== col.key) {
                      onReorder(sourceKey, col.key);
                    }
                    setDraggedKey(null);
                    setDragOverKey(null);
                  }}
                  onDragEnd={() => {
                    setDraggedKey(null);
                    setDragOverKey(null);
                  }}
                  className={clsx(
                    "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition-all",
                    isDragging && "opacity-40 bg-primary-50",
                    isOver && "border-t-2 border-t-primary-600 bg-primary-50/50",
                    col.required ? "opacity-75" : "hover:bg-surface-hover",
                  )}
                >
                  <label className="flex flex-1 items-center gap-2 truncate cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={col.required}
                      onChange={() => toggleColumn(col.key, col.required)}
                      className="h-3.5 w-3.5 rounded border-border-strong text-primary-600 focus:ring-primary-500 accent-primary-600 cursor-pointer"
                    />
                    <span className={clsx("truncate", isChecked ? "text-ink font-medium" : "text-ink-muted")}>
                      {col.label}
                    </span>
                  </label>

                  <div className="flex items-center gap-1 shrink-0">
                    {col.required ? (
                      <span className="text-[10px] font-medium text-ink-faint bg-surface-sunken px-1 rounded">Fixed</span>
                    ) : onReorder ? (
                      <span className="p-0.5 text-ink-faint hover:text-ink cursor-grab active:cursor-grabbing" title="Drag to reorder">
                        <GripVertical className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border/80 pt-1.5 flex items-center justify-between">
            <button
              type="button"
              onClick={showAll}
              className="w-full rounded-md px-2 py-1 text-center text-[11.5px] font-semibold text-primary-700 hover:bg-primary-50 cursor-pointer"
            >
              Show All Columns
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
