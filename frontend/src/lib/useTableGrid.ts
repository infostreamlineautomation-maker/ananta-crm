"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ColumnDef } from "@/components/ui/ColumnSelector";

export interface UseTableGridOptions {
  tableKey: string;
  defaultColumns: ColumnDef[];
  defaultVisibleKeys?: string[];
  minColumnWidth?: number;
}

/**
 * Normalizes columns so that:
 * 1. 'select' is always the first column (index 0).
 * 2. 'actions' (or 'action') is always the last column (index length - 1).
 * 3. Intermediate columns keep their relative ordering.
 */
function normalizeColumnOrder(cols: ColumnDef[]): ColumnDef[] {
  let selectCol: ColumnDef | null = null;
  let actionsCol: ColumnDef | null = null;
  const middleCols: ColumnDef[] = [];

  for (const c of cols) {
    if (c.key === "select") {
      selectCol = c;
    } else if (c.key === "actions" || c.key === "action") {
      actionsCol = c;
    } else {
      middleCols.push(c);
    }
  }

  const result: ColumnDef[] = [];
  if (selectCol) result.push(selectCol);
  result.push(...middleCols);
  if (actionsCol) result.push(actionsCol);
  return result;
}

export function useTableGrid({
  tableKey,
  defaultColumns,
  defaultVisibleKeys,
  minColumnWidth = 60,
}: UseTableGridOptions) {
  const storageOrderKey = `crm_grid_order_${tableKey}`;
  const storageVisibleKey = `crm_grid_visible_${tableKey}`;
  const storageWidthsKey = `crm_grid_widths_${tableKey}`;

  // 1. Column ordering - strictly pinned: 'select' first, 'actions' last
  const [columns, setColumns] = useState<ColumnDef[]>(() => {
    if (typeof window === "undefined") return normalizeColumnOrder(defaultColumns);
    try {
      const saved = localStorage.getItem(storageOrderKey);
      if (saved) {
        const orderKeys: string[] = JSON.parse(saved);
        const colMap = new Map(defaultColumns.map((c) => [c.key, c]));
        const ordered: ColumnDef[] = [];
        // Add existing in saved order
        for (const k of orderKeys) {
          if (colMap.has(k)) {
            ordered.push(colMap.get(k)!);
            colMap.delete(k);
          }
        }
        // Append any new columns not in saved order
        for (const c of colMap.values()) {
          ordered.push(c);
        }
        return normalizeColumnOrder(ordered);
      }
    } catch {}
    return normalizeColumnOrder(defaultColumns);
  });

  // Sync if defaultColumns definition changes (e.g. custom fields loaded)
  useEffect(() => {
    setColumns((prev) => {
      const colMap = new Map(defaultColumns.map((c) => [c.key, c]));
      const next: ColumnDef[] = [];
      for (const p of prev) {
        if (colMap.has(p.key)) {
          next.push({ ...p, ...colMap.get(p.key)! });
          colMap.delete(p.key);
        }
      }
      for (const c of colMap.values()) {
        next.push(c);
      }
      return normalizeColumnOrder(next);
    });
  }, [defaultColumns]);

  // 2. Visible Columns
  const [visibleColumns, setVisibleColumnsState] = useState<Set<string>>(() => {
    if (typeof window === "undefined") {
      return new Set(defaultVisibleKeys || defaultColumns.filter((c) => c.defaultVisible !== false).map((c) => c.key));
    }
    try {
      const saved = localStorage.getItem(storageVisibleKey);
      if (saved) {
        const keys: string[] = JSON.parse(saved);
        return new Set(keys);
      }
    } catch {}
    return new Set(defaultVisibleKeys || defaultColumns.filter((c) => c.defaultVisible !== false).map((c) => c.key));
  });

  const setVisibleColumns = useCallback(
    (valOrUpdater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setVisibleColumnsState((prev) => {
        const next = typeof valOrUpdater === "function" ? valOrUpdater(prev) : valOrUpdater;
        try {
          localStorage.setItem(storageVisibleKey, JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });
    },
    [storageVisibleKey]
  );

  // 3. Column Widths
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem(storageWidthsKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const setColumnWidth = useCallback(
    (key: string, width: number) => {
      setColumnWidths((prev) => {
        const next = { ...prev, [key]: Math.max(minColumnWidth, Math.round(width)) };
        try {
          localStorage.setItem(storageWidthsKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [minColumnWidth, storageWidthsKey]
  );

  // 4. Reorder Columns with actions and select pinned
  const reorderColumns = useCallback(
    (sourceKey: string, targetKey: string) => {
      if (!sourceKey || !targetKey || sourceKey === targetKey) return;
      // Do not allow dragging 'select' or 'actions'
      if (sourceKey === "select" || sourceKey === "actions" || sourceKey === "action") return;
      if (targetKey === "select" || targetKey === "actions" || targetKey === "action") return;

      setColumns((prev) => {
        const sourceIndex = prev.findIndex((c) => c.key === sourceKey);
        const targetIndex = prev.findIndex((c) => c.key === targetKey);
        if (sourceIndex === -1 || targetIndex === -1) return prev;

        const updated = [...prev];
        const [moved] = updated.splice(sourceIndex, 1);
        updated.splice(targetIndex, 0, moved);

        const normalized = normalizeColumnOrder(updated);

        try {
          localStorage.setItem(storageOrderKey, JSON.stringify(normalized.map((c) => c.key)));
        } catch {}
        return normalized;
      });
    },
    [storageOrderKey]
  );

  // 5. Reset Grid
  const resetGrid = useCallback(() => {
    try {
      localStorage.removeItem(storageOrderKey);
      localStorage.removeItem(storageVisibleKey);
      localStorage.removeItem(storageWidthsKey);
    } catch {}
    const normalized = normalizeColumnOrder(defaultColumns);
    setColumns(normalized);
    setVisibleColumnsState(
      new Set(defaultVisibleKeys || normalized.filter((c) => c.defaultVisible !== false).map((c) => c.key))
    );
    setColumnWidths({});
  }, [defaultColumns, defaultVisibleKeys, storageOrderKey, storageVisibleKey, storageWidthsKey]);

  // Drag-and-Drop state for header
  const [draggedColKey, setDraggedColKey] = useState<string | null>(null);
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null);
  const [resizingKey, setResizingKey] = useState<string | null>(null);

  const startResizing = useCallback(
    (key: string, startX: number, startWidth: number) => {
      setResizingKey(key);
      const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startX;
        const newWidth = Math.max(minColumnWidth, startWidth + delta);
        setColumnWidth(key, newWidth);
      };

      const onMouseUp = () => {
        setResizingKey(null);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [minColumnWidth, setColumnWidth]
  );

  return {
    columns,
    visibleColumns,
    setVisibleColumns,
    columnWidths,
    setColumnWidth,
    reorderColumns,
    resetGrid,
    draggedColKey,
    setDraggedColKey,
    dragOverColKey,
    setDragOverColKey,
    resizingKey,
    startResizing,
  };
}
