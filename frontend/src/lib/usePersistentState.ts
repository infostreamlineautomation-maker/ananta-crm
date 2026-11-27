"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * React state synced with localStorage so user-selected filters, searches,
 * and date ranges survive navigation and page reloads until explicitly cleared.
 */
export function usePersistentState<T>(storageKey: string, defaultValue: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) {
        return JSON.parse(raw) as T;
      }
    } catch {}
    return defaultValue;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const isDefault =
        state === defaultValue ||
        state === null ||
        state === "" ||
        (typeof state === "object" &&
          state !== null &&
          defaultValue !== null &&
          typeof defaultValue === "object" &&
          JSON.stringify(state) === JSON.stringify(defaultValue));

      if (isDefault) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(state));
      }
    } catch {}
  }, [storageKey, state, defaultValue]);

  return [state, setState] as const;
}

/**
 * Compact persisted key-value filter dictionary (e.g. per-detail-page tabs).
 */
export function usePersistentFilterMap(storageKey: string) {
  const [filters, setFilters] = usePersistentState<Record<string, string>>(
    storageKey,
    {}
  );

  const getValue = useCallback(
    (key: string, fallback = "") => filters[key] ?? fallback,
    [filters]
  );

  const setValue = useCallback(
    (key: string, value: string) => {
      setFilters((prev) => {
        const next = { ...prev };
        if (!value) {
          delete next[key];
        } else {
          next[key] = value;
        }
        return next;
      });
    },
    [setFilters]
  );

  const clearKeys = useCallback(
    (keys: string[]) => {
      setFilters((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const k of keys) {
          if (k in next) {
            delete next[k];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
    [setFilters]
  );

  return { filters, getValue, setValue, clearKeys, setFilters };
}
