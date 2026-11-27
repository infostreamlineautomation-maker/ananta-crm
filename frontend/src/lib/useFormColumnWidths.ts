"use client";

import { useCallback, useEffect, useState } from "react";

export function useFormColumnWidths(
  tableKey: string,
  defaultWidths: Record<string, number>,
  minWidth = 56
) {
  const storageKey = `crm_form_col_widths_${tableKey}`;

  const [overrides, setOverrides] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      }
    } catch {}
    return {};
  });

  const [resizingKey, setResizingKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (Object.keys(overrides).length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(overrides));
      }
    } catch {}
  }, [overrides, storageKey]);

  const getWidth = useCallback(
    (key: string, fallback = 115): number => {
      const val = overrides[key] ?? defaultWidths[key];
      return typeof val === "number" && Number.isFinite(val) ? Math.max(minWidth, val) : fallback;
    },
    [overrides, defaultWidths, minWidth]
  );

  const setColumnWidth = useCallback(
    (key: string, width: number) => {
      const clamped = Math.max(minWidth, Math.round(width));
      setOverrides((prev) => ({ ...prev, [key]: clamped }));
    },
    [minWidth]
  );

  const resetWidth = useCallback((key: string) => {
    setOverrides((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const resetAllWidths = useCallback(() => {
    setOverrides({});
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  const startResize = useCallback(
    (key: string, e: React.MouseEvent, thEl?: HTMLElement | null) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const measuredWidth = thEl?.getBoundingClientRect().width;
      const startWidth =
        measuredWidth && measuredWidth > 0 ? measuredWidth : getWidth(key);

      setResizingKey(key);
      const prevCursor = document.body.style.cursor;
      const prevUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        setColumnWidth(key, startWidth + delta);
      };

      const handleMouseUp = () => {
        setResizingKey(null);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevUserSelect;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [getWidth, setColumnWidth]
  );

  return {
    overrides,
    getWidth,
    setColumnWidth,
    resetWidth,
    resetAllWidths,
    hasCustomWidths: Object.keys(overrides).length > 0,
    resizingKey,
    startResize,
  };
}
