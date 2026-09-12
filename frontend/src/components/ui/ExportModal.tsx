"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckSquare, Download, FileSpreadsheet, FileText, FileType, Search, Square, X } from "lucide-react";
import clsx from "clsx";
import { ExportColumn, ExportFormat, exportData } from "@/lib/export-utils";
import { useToast } from "@/components/ui/Toast";
import { useOrganization } from "@/lib/organization-context";
import { Button } from "@/components/ui/Button";

export interface ExportModalProps<T = any> {
  open: boolean;
  onClose: () => void;
  data: T[];
  selectedData?: T[];
  columns: ExportColumn<T>[];
  filename?: string;
  title?: string;
  companyName?: string;
}

export function ExportModal<T>({
  open,
  onClose,
  data,
  selectedData = [],
  columns,
  filename = "export",
  title = "Export Report",
  companyName: customCompanyName,
}: ExportModalProps<T>) {
  const toast = useToast();
  const { activeOrganization } = useOrganization();

  const activeCompanyName = customCompanyName || activeOrganization?.name || "Ananta Graphics";
  const primaryColor = activeOrganization?.primary_color || "#C31432";

  const hasSelected = selectedData && selectedData.length > 0;
  const [scope, setScope] = useState<"selected" | "all">(hasSelected ? "selected" : "all");
  const [format, setFormat] = useState<ExportFormat>("excel");
  const [search, setSearch] = useState("");
  const [selectedHeaders, setSelectedHeaders] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  // Initialize selected columns (with localStorage persistence)
  const storageKey = `export_columns_${title.replace(/\s+/g, "_").toLowerCase()}`;

  useEffect(() => {
    if (!open) return;
    setScope(hasSelected ? "selected" : "all");

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter to valid headers that still exist
          const valid = parsed.filter((h: string) => columns.some((c) => c.header === h));
          if (valid.length > 0) {
            setSelectedHeaders(new Set(valid));
            return;
          }
        }
      }
    } catch {}

    // Default: select all columns (or those with defaultSelected !== false)
    const defaults = columns.filter((c) => c.defaultSelected !== false).map((c) => c.header);
    setSelectedHeaders(new Set(defaults.length > 0 ? defaults : columns.map((c) => c.header)));
  }, [open, storageKey, hasSelected, columns]);

  // Group columns by category if provided
  const categorizedColumns = useMemo(() => {
    const groups: { category: string; cols: ExportColumn<T>[] }[] = [];
    const uncategorized: ExportColumn<T>[] = [];

    columns.forEach((col) => {
      if (col.category) {
        let group = groups.find((g) => g.category === col.category);
        if (!group) {
          group = { category: col.category, cols: [] };
          groups.push(group);
        }
        group.cols.push(col);
      } else {
        uncategorized.push(col);
      }
    });

    if (uncategorized.length > 0) {
      if (groups.length > 0) {
        groups.push({ category: "General / Other", cols: uncategorized });
      } else {
        groups.push({ category: "Available Fields", cols: uncategorized });
      }
    }

    return groups;
  }, [columns]);

  // Filter columns by search
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categorizedColumns;

    return categorizedColumns
      .map((group) => ({
        category: group.category,
        cols: group.cols.filter((c) => c.header.toLowerCase().includes(q)),
      }))
      .filter((g) => g.cols.length > 0);
  }, [categorizedColumns, search]);

  const toggleColumn = (header: string) => {
    const next = new Set(selectedHeaders);
    if (next.has(header)) {
      next.delete(header);
    } else {
      next.add(header);
    }
    setSelectedHeaders(next);
  };

  const handleSelectAll = () => {
    setSelectedHeaders(new Set(columns.map((c) => c.header)));
  };

  const handleDeselectAll = () => {
    setSelectedHeaders(new Set());
  };

  const handleReset = () => {
    const defaults = columns.filter((c) => c.defaultSelected !== false).map((c) => c.header);
    setSelectedHeaders(new Set(defaults));
  };

  const handleExport = async () => {
    if (selectedHeaders.size === 0) {
      toast.error("Please select at least one column to export.");
      return;
    }

    const targetData = scope === "selected" && hasSelected ? selectedData : data;
    if (!targetData || targetData.length === 0) {
      toast.error("No data available to export.");
      return;
    }

    const activeCols = columns.filter((c) => selectedHeaders.has(c.header));
    if (activeCols.length === 0) {
      toast.error("No matching columns selected.");
      return;
    }

    // Save preferences
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(selectedHeaders)));
    } catch {}

    setExporting(true);
    try {
      exportData(format, targetData, activeCols, filename, title, {
        companyName: activeCompanyName,
        primaryColor,
      });
      const formatLabels = { excel: "Excel (.xlsx)", csv: "CSV (.csv)", pdf: "PDF (.pdf)" };
      toast.success(`Exported ${targetData.length} records to ${formatLabels[format]} for ${activeCompanyName}.`);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  const currentCount = (scope === "selected" && hasSelected ? selectedData : data).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-white shadow-2xl animate-in zoom-in-95 duration-150"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            <p className="text-xs text-ink-muted">
              Configure data scope, format, and custom columns for {activeCompanyName}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. Scope Selection */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">1. Data Scope</label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label
                className={clsx(
                  "flex cursor-pointer items-center justify-between rounded-lg border p-3 text-xs transition-all",
                  scope === "all"
                    ? "border-primary-500 bg-primary-50/40 text-primary-950 font-semibold ring-1 ring-primary-500"
                    : "border-border bg-white text-ink hover:bg-surface-sunken",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="exportScope"
                    checked={scope === "all"}
                    onChange={() => setScope("all")}
                    className="accent-primary-600"
                  />
                  <span>All Matching Records</span>
                </div>
                <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-[11px] font-bold text-ink-muted">
                  {data.length}
                </span>
              </label>

              <label
                className={clsx(
                  "flex cursor-pointer items-center justify-between rounded-lg border p-3 text-xs transition-all",
                  scope === "selected"
                    ? "border-primary-500 bg-primary-50/40 text-primary-950 font-semibold ring-1 ring-primary-500"
                    : "border-border bg-white text-ink hover:bg-surface-sunken",
                  !hasSelected && "cursor-not-allowed opacity-50",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="exportScope"
                    checked={scope === "selected"}
                    onChange={() => hasSelected && setScope("selected")}
                    disabled={!hasSelected}
                    className="accent-primary-600"
                  />
                  <span>Selected Bulk Records</span>
                </div>
                <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-[11px] font-bold text-ink-muted">
                  {selectedData.length}
                </span>
              </label>
            </div>
          </div>

          {/* 2. Format Selection */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">2. Export File Format</label>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setFormat("excel")}
                className={clsx(
                  "flex flex-col items-center gap-2 rounded-lg border p-3.5 text-center cursor-pointer transition-all",
                  format === "excel"
                    ? "border-emerald-600 bg-emerald-50/60 text-emerald-950 font-bold ring-1 ring-emerald-600 shadow-xs"
                    : "border-border bg-white text-ink hover:bg-surface-sunken",
                )}
              >
                <div className={clsx("rounded-md p-2", format === "excel" ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700")}>
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs">Excel (.xlsx)</div>
                  <div className="text-[10.5px] text-ink-muted font-normal">Spreadsheet table</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={clsx(
                  "flex flex-col items-center gap-2 rounded-lg border p-3.5 text-center cursor-pointer transition-all",
                  format === "csv"
                    ? "border-sky-600 bg-sky-50/60 text-sky-950 font-bold ring-1 ring-sky-600 shadow-xs"
                    : "border-border bg-white text-ink hover:bg-surface-sunken",
                )}
              >
                <div className={clsx("rounded-md p-2", format === "csv" ? "bg-sky-600 text-white" : "bg-sky-100 text-sky-700")}>
                  <FileType className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs">CSV (.csv)</div>
                  <div className="text-[10.5px] text-ink-muted font-normal">Comma-separated</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat("pdf")}
                className={clsx(
                  "flex flex-col items-center gap-2 rounded-lg border p-3.5 text-center cursor-pointer transition-all",
                  format === "pdf"
                    ? "border-rose-600 bg-rose-50/60 text-rose-950 font-bold ring-1 ring-rose-600 shadow-xs"
                    : "border-border bg-white text-ink hover:bg-surface-sunken",
                )}
              >
                <div className={clsx("rounded-md p-2", format === "pdf" ? "bg-rose-600 text-white" : "bg-rose-100 text-rose-700")}>
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs">PDF (.pdf)</div>
                  <div className="text-[10.5px] text-ink-muted font-normal">Formatted print</div>
                </div>
              </button>
            </div>
          </div>

          {/* 3. Column Selection */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                3. Choose Columns ({selectedHeaders.size} of {columns.length} selected)
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="font-semibold text-primary-600 hover:text-primary-700 hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-border">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="font-semibold text-ink-muted hover:text-ink hover:underline cursor-pointer"
                >
                  Deselect All
                </button>
                <span className="text-border">|</span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="font-semibold text-ink-muted hover:text-ink hover:underline cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

            {columns.length > 8 && (
              <div className="relative mt-2.5">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter available fields..."
                  className="h-8 w-full rounded-md border border-border bg-surface-sunken/40 pl-8 pr-3 text-xs text-ink placeholder:text-ink-faint focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            )}

            <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface-sunken/20 p-3 space-y-3">
              {filteredGroups.map((group) => (
                <div key={group.category} className="space-y-1.5">
                  {categorizedColumns.length > 1 && (
                    <div className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint px-1">
                      {group.category}
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {group.cols.map((col) => {
                      const checked = selectedHeaders.has(col.header);
                      return (
                        <button
                          key={col.header}
                          type="button"
                          onClick={() => toggleColumn(col.header)}
                          className={clsx(
                            "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer",
                            checked
                              ? "border-primary-300 bg-white font-semibold text-ink shadow-2xs"
                              : "border-transparent bg-transparent text-ink-muted hover:bg-white/80",
                          )}
                        >
                          {checked ? (
                            <CheckSquare className="h-4 w-4 shrink-0 text-primary-600" />
                          ) : (
                            <Square className="h-4 w-4 shrink-0 text-ink-faint" />
                          )}
                          <span className="truncate" title={col.header}>
                            {col.header}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {filteredGroups.length === 0 && (
                <p className="py-4 text-center text-xs text-ink-faint">No columns match &quot;{search}&quot;</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-surface-sunken/30">
          <div className="text-xs text-ink-muted">
            Exporting <span className="font-bold text-ink">{currentCount} records</span> with{" "}
            <span className="font-bold text-ink">{selectedHeaders.size} columns</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" onClick={onClose} disabled={exporting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleExport} loading={exporting} disabled={selectedHeaders.size === 0 || currentCount === 0}>
              <Download className="h-4 w-4 mr-1.5" />
              Download {format.toUpperCase()}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
