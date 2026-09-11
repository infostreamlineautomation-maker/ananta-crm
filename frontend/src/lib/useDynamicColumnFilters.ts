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

export interface DynamicFilterColumn {
  key: string;
  label: string;
  type: ColumnFilterType;
  options?: FilterOption[];
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
  onFilterChange?: (filters: Record<string, string>) => void;
}

export function useDynamicColumnFilters({
  module,
  baseColumns,
  initialFilters = {},
  onFilterChange,
}: UseDynamicColumnFiltersOptions) {
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(initialFilters);

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

  // Reset all active filters
  const resetFilters = useCallback(() => {
    setActiveFilters({});
    if (onFilterChange) onFilterChange({});
  }, [onFilterChange]);

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

  // Helper to compile active filters into query params
  const appendQueryParams = useCallback(
    (params: URLSearchParams) => {
      for (const [k, v] of Object.entries(activeFilters)) {
        if (v && v.trim() !== "") {
          params.set(k, v.trim());
        }
      }
    },
    [activeFilters]
  );

  return {
    columns: allFilterColumns,
    customFields,
    activeFilters,
    setFilter,
    setFilters,
    resetFilters,
    activeCount,
    appendQueryParams,
  };
}
