"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { apiFetch } from "./api";
import { CustomFieldDefinition, CustomFieldModule } from "./types";

export type ColumnFilterType = "text" | "select" | "date_range" | "amount_range" | "boolean";

export interface FilterColumnOption {
  value: string;
  label: string;
  tone?: string;
  dotColor?: string;
}

export interface FilterSuggestion {
  value: string;
  label: string;
  sublabel?: string;
}

export interface DynamicFilterColumn {
  key: string;
  label: string;
  type: ColumnFilterType;
  options?: FilterOption[];
  suggestions?: FilterSuggestion[];
  isCustom?: boolean;
  minPlaceholder?: string;
  maxPlaceholder?: string;
  placeholder?: string;
}

export interface FilterOption {
  value: string;
  label: string;
  tone?: string;
  dotColor?: string;
}

export interface UseDynamicColumnFiltersOptions {
  module?: CustomFieldModule | string;
  baseColumns: DynamicFilterColumn[];
  initialFilters?: Record<string, string>;
  initialOrdering?: string | null;
  onFilterChange?: (filters: Record<string, string>) => void;
  onOrderingChange?: (ordering: string | null) => void;
}

export function useDynamicColumnFilters({
  module,
  baseColumns,
  initialFilters = {},
  initialOrdering = null,
  onFilterChange,
  onOrderingChange,
}: UseDynamicColumnFiltersOptions) {
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(initialFilters);
  const [ordering, setOrderingState] = useState<string | null>(initialOrdering ?? null);

  // Fetch dynamic custom columns for the module
  useEffect(() => {
    if (!module) return;
    let isMounted = true;
    apiFetch<CustomFieldDefinition[]>(`/api/custom-fields/?module=${module}`)
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setCustomFields(data);
        }
      })
      .catch(() => {
        // Silently fallback if custom fields aren't available
      });
    return () => {
      isMounted = false;
    };
  }, [module]);

  // Combine base static columns with dynamically loaded custom columns
  const allFilterColumns = useMemo<DynamicFilterColumn[]>(() => {
    const dynamicCols: DynamicFilterColumn[] = customFields.map((cf) => {
      let filterType: ColumnFilterType = "text";
      if (cf.field_type === "select") filterType = "select";
      else if (cf.field_type === "number") filterType = "amount_range";
      else if (cf.field_type === "date") filterType = "date_range";
      else if (cf.field_type === "boolean") filterType = "boolean";

      const options: FilterOption[] | undefined =
        cf.field_type === "select" && cf.options
          ? cf.options.map((opt) => ({ value: opt, label: opt }))
          : cf.field_type === "boolean"
          ? [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ]
          : undefined;

      return {
        key: `custom__${cf.field_key}`,
        label: cf.label,
        type: filterType,
        options,
        isCustom: true,
      };
    });

    return [...baseColumns, ...dynamicCols];
  }, [baseColumns, customFields]);

  // Update a single filter value
  const setFilter = useCallback(
    (key: string, value: string) => {
      setActiveFilters((prev) => {
        const next = { ...prev };
        if (!value || value.trim() === "") {
          delete next[key];
        } else {
          next[key] = value;
        }
        if (onFilterChange) onFilterChange(next);
        return next;
      });
    },
    [onFilterChange]
  );

  // Update multiple filters at once
  const setFilters = useCallback(
    (filters: Record<string, string>) => {
      setActiveFilters(() => {
        const clean: Record<string, string> = {};
        for (const [k, v] of Object.entries(filters)) {
          if (v && v.trim() !== "") {
            clean[k] = v;
          }
        }
        if (onFilterChange) onFilterChange(clean);
        return clean;
      });
    },
    [onFilterChange]
  );

  // Reset all active filters (and restore default ordering)
  const resetFilters = useCallback(() => {
    setActiveFilters({});
    setOrderingState(initialOrdering ?? null);
    if (onFilterChange) onFilterChange({});
    if (onOrderingChange) onOrderingChange(initialOrdering ?? null);
  }, [initialOrdering, onFilterChange, onOrderingChange]);

  // Compute total active filter count (merging range pairs)
  const activeCount = useMemo(() => {
    const countedKeys = new Set<string>();
    let count = 0;

    for (const [k, v] of Object.entries(activeFilters)) {
      if (!v) continue;
      if (k.endsWith("_min") || k.endsWith("_max")) {
        const baseKey = k.replace(/_(min|max)$/, "");
        if (!countedKeys.has(baseKey)) {
          countedKeys.add(baseKey);
          count++;
        }
      } else if (k.endsWith("_from") || k.endsWith("_to")) {
        const baseKey = k.replace(/_(from|to)$/, "");
        if (!countedKeys.has(baseKey)) {
          countedKeys.add(baseKey);
          count++;
        }
      } else {
        count++;
      }
    }
    return count;
  }, [activeFilters]);

  // Ordering handlers
  const setOrdering = useCallback(
    (newOrdering: string | null) => {
      setOrderingState(newOrdering);
      if (onOrderingChange) onOrderingChange(newOrdering);
    },
    [onOrderingChange]
  );

  const toggleOrdering = useCallback(
    (field: string, defaultDesc: boolean = false) => {
      setOrderingState((prev) => {
        let next: string | null = null;
        if (defaultDesc) {
          if (prev === `-${field}`) {
            next = field;
          } else if (prev === field) {
            next = initialOrdering === `-${field}` ? `-${field}` : null;
          } else {
            next = `-${field}`;
          }
        } else {
          if (prev === field) {
            next = `-${field}`;
          } else if (prev === `-${field}`) {
            next = null;
          } else {
            next = field;
          }
        }
        if (onOrderingChange) onOrderingChange(next);
        return next;
      });
    },
    [initialOrdering, onOrderingChange]
  );

  const getOrderingFor = useCallback(
    (field: string): "asc" | "desc" | null => {
      if (!ordering) return null;
      if (ordering === field) return "asc";
      if (ordering === `-${field}`) return "desc";
      return null;
    },
    [ordering]
  );

  // Helper to compile active filters and ordering into query params
  const appendQueryParams = useCallback(
    (params: URLSearchParams) => {
      if (ordering && ordering.trim() !== "") {
        params.set("ordering", ordering.trim());
      }
      for (const [k, v] of Object.entries(activeFilters)) {
        if (v && v.trim() !== "") {
          params.set(k, v.trim());
        }
      }
    },
    [activeFilters, ordering]
  );

  return {
    columns: allFilterColumns,
    customFields,
    activeFilters,
    ordering,
    setOrdering,
    toggleOrdering,
    getOrderingFor,
    setFilter,
    setFilters,
    resetFilters,
    activeCount,
    appendQueryParams,
  };
}
