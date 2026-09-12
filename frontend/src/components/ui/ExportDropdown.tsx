"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, FileType, Settings2 } from "lucide-react";
import clsx from "clsx";
import { ExportColumn, ExportFormat, exportData } from "@/lib/export-utils";
import { useToast } from "@/components/ui/Toast";
import { useOrganization } from "@/lib/organization-context";
import { ExportModal } from "./ExportModal";

export interface ExportDropdownProps<T = any> {
  data?: T[];
  selectedData?: T[];
  selectedIds?: Set<number | string>;
  columns?: ExportColumn<T>[];
  filename?: string;
  title?: string;
  disabled?: boolean;
  className?: string;
  variant?: "primary" | "secondary" | "outline";
  buttonText?: string;
  companyName?: string;
  onExport?: (format: ExportFormat) => void | Promise<void>;
}

export function ExportDropdown<T>({
  data = [],
  selectedData: explicitSelectedData,
  selectedIds,
  columns,
  filename = "export",
  title = "Export Report",
  disabled = false,
  className = "",
  variant = "secondary",
  buttonText = "Export",
  companyName: customCompanyName,
  onExport,
}: ExportDropdownProps<T>) {
  const toast = useToast();
  const { activeOrganization } = useOrganization();
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeCompanyName = customCompanyName || activeOrganization?.name || "Ananta Graphics";
  const primaryColor = activeOrganization?.primary_color || "#C31432";

  // Compute selected data items
  const computedSelectedData = useMemo(() => {
    if (explicitSelectedData && explicitSelectedData.length > 0) return explicitSelectedData;
    if (selectedIds && selectedIds.size > 0 && data.length > 0) {
      return data.filter((item: any) => selectedIds.has(item.id));
    }
    return [];
  }, [explicitSelectedData, selectedIds, data]);

  const hasSelection = computedSelectedData.length > 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleQuickExport = async (format: ExportFormat) => {
    setOpen(false);
    setExporting(format);

    try {
      if (onExport) {
        await onExport(format);
      } else {
        if (!data || data.length === 0 || !columns) {
          toast.error("No data available to export.");
          return;
        }
        const targetData = hasSelection ? computedSelectedData : data;
        const docTitle = title || filename.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
        exportData(format, targetData, columns, filename, docTitle, {
          companyName: activeCompanyName,
          primaryColor,
        });
        const labels = { excel: "Excel (.xlsx)", csv: "CSV (.csv)", pdf: "PDF (.pdf)" };
        toast.success(`Exported ${targetData.length} records to ${labels[format]} for ${activeCompanyName}.`);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to export ${format.toUpperCase()}. Please try again.`);
    } finally {
      setExporting(null);
    }
  };

  const isEmpty = !onExport && (!data || data.length === 0);

  return (
    <>
      <div className={clsx("relative inline-block text-left", className)} ref={dropdownRef}>
        <div className="inline-flex rounded-md shadow-2xs">
          {/* Main button: opens customize modal if columns are provided */}
          <button
            type="button"
            disabled={disabled || isEmpty}
            onClick={() => {
              if (columns && columns.length > 0) {
                setModalOpen(true);
              } else {
                setOpen((prev) => !prev);
              }
            }}
            className={clsx(
              "inline-flex h-9 items-center gap-1.5 rounded-l-md border px-3 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer",
              variant === "primary"
                ? "border-primary-500 bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700"
                : "border-border bg-white text-ink-muted hover:bg-surface-sunken hover:text-ink",
              (disabled || isEmpty) && "cursor-not-allowed opacity-50",
            )}
            title={isEmpty ? "No data to export" : "Customize & Export"}
          >
            <Download className="h-3.5 w-3.5" />
            <span>
              {hasSelection ? `Export (${computedSelectedData.length})` : buttonText}
            </span>
          </button>

          {/* Dropdown toggle for quick formats */}
          <button
            type="button"
            disabled={disabled || isEmpty}
            onClick={() => setOpen((prev) => !prev)}
            className={clsx(
              "inline-flex h-9 items-center border-y border-r px-2 text-xs font-semibold rounded-r-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer",
              variant === "primary"
                ? "border-primary-500 bg-primary-600 text-white hover:bg-primary-700"
                : "border-border bg-white text-ink-muted hover:bg-surface-sunken hover:text-ink",
              (disabled || isEmpty) && "cursor-not-allowed opacity-50",
            )}
            title="Quick export formats"
          >
            <ChevronDown className={clsx("h-3 w-3 transition-transform duration-200", open && "rotate-180")} />
          </button>
        </div>

        {open && (
          <div className="absolute right-0 z-50 mt-1.5 w-64 origin-top-right rounded-lg border border-border bg-white p-1.5 shadow-[var(--shadow-pop)] animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2.5 py-1.5 border-b border-border/50 mb-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                {hasSelection ? `Export ${computedSelectedData.length} selected records` : `Export all ${data.length} records`}
              </div>
              <div className="text-[11.5px] font-bold text-primary-600 truncate">
                {activeCompanyName}
              </div>
            </div>

            {/* Customize Columns Option */}
            {columns && columns.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setModalOpen(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs font-medium text-ink transition-colors hover:bg-primary-50 hover:text-primary-900 group mb-1 border-b border-border/40"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-100 text-primary-700 group-hover:bg-primary-200 transition-colors">
                  <Settings2 className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-primary-700">Choose Columns & Export</span>
                  <span className="text-[10.5px] text-ink-muted">Select specific fields & scope</span>
                </div>
              </button>
            )}

            {/* 1. Quick Excel Option */}
            <button
              type="button"
              onClick={() => handleQuickExport("excel")}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs font-medium text-ink transition-colors hover:bg-emerald-50 hover:text-emerald-900 group"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200 transition-colors">
                <FileSpreadsheet className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold">Quick Excel (.xlsx)</span>
                <span className="text-[10.5px] text-ink-muted group-hover:text-emerald-700">
                  {hasSelection ? `${computedSelectedData.length} selected rows` : "All records"}
                </span>
              </div>
            </button>

            {/* 2. Quick CSV Option */}
            <button
              type="button"
              onClick={() => handleQuickExport("csv")}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs font-medium text-ink transition-colors hover:bg-sky-50 hover:text-sky-900 group"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-100 text-sky-700 group-hover:bg-sky-200 transition-colors">
                <FileType className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold">Quick CSV (.csv)</span>
                <span className="text-[10.5px] text-ink-muted group-hover:text-sky-700">Comma-separated</span>
              </div>
            </button>

            {/* 3. Quick PDF Option */}
            <button
              type="button"
              onClick={() => handleQuickExport("pdf")}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs font-medium text-ink transition-colors hover:bg-rose-50 hover:text-rose-900 group"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-100 text-rose-700 group-hover:bg-rose-200 transition-colors">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold">Quick PDF (.pdf)</span>
                <span className="text-[10.5px] text-ink-muted group-hover:text-rose-700">Printable table</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Modal for column picking and custom scope */}
      {columns && columns.length > 0 && (
        <ExportModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          data={data}
          selectedData={computedSelectedData}
          columns={columns}
          filename={filename}
          title={title}
          companyName={activeCompanyName}
        />
      )}
    </>
  );
}
