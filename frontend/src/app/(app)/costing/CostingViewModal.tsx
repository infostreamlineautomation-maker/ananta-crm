"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Pencil,
  Plus,
  Printer,
  Sparkles,
  User,
  X,
  ZoomIn,
} from "lucide-react";
import clsx from "clsx";
import { CostingDetail } from "@/lib/types";
import { formatCurrency, formatDate, mediaUrl } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";

function formatFileSize(bytes?: number | null) {
  if (!bytes || isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name?: string | null) {
  const ext = name?.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) {
    return <FileText className="h-5 w-5 text-rose-600" />;
  }
  if (["xlsx", "xls", "csv"].includes(ext)) {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
  }
  if (["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext)) {
    return <ImageIcon className="h-5 w-5 text-blue-600" />;
  }
  return <Paperclip className="h-5 w-5 text-primary-600" />;
}

function isImageFile(name?: string | null) {
  const ext = name?.split(".").pop()?.toLowerCase() || "";
  return ["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext);
}

export function CostingViewModal({
  costing,
  open,
  onClose,
  canEdit = true,
}: {
  costing: CostingDetail | null;
  open: boolean;
  onClose: () => void;
  canEdit?: boolean;
}) {
  const [previewLightbox, setPreviewLightbox] = useState<string | null>(null);

  if (!costing) return null;

  const firstItem = costing.items?.[0];
  const profit = parseFloat(costing.profit || "0");
  const profitPercent = parseFloat(costing.profit_percent || "0");

  const allFiles =
    costing.files && costing.files.length > 0
      ? costing.files
      : costing.file
      ? [{ file: costing.file, file_name: costing.file_name }]
      : [];

  const extraEntries = Object.entries(firstItem?.extra_data || {});

  return (
    <>
      <Modal open={open} onClose={onClose} title={`Costing Sheet #${costing.id}`} width="max-w-2xl">
        <div className="flex flex-col gap-5">
          {/* Header summary badge banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-sunken/30 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 border border-primary-100 dark:border-primary-900">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-ink">{costing.client_display || "Costing Sheet"}</h3>
                <p className="text-xs text-ink-muted flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-ink-faint" />
                    {formatDate(costing.costing_date)}
                  </span>
                  {costing.project_name && (
                    <>
                      <span>·</span>
                      <span>Project: {costing.project_name}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold shadow-2xs",
                  profitPercent >= 20
                    ? "bg-success-50 text-success-700 border border-success-200"
                    : profitPercent > 0
                    ? "bg-warning-50 text-warning-700 border border-warning-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                )}
              >
                {profitPercent.toFixed(1)}% Margin
              </span>
            </div>
          </div>

          {/* Key Details Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-surface p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Client</span>
              <p className="mt-1 text-sm font-bold text-ink truncate" title={costing.client_display || "—"}>
                {costing.client_display || "—"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Supplier / Vendor</span>
              <p className="mt-1 text-sm font-bold text-ink truncate" title={costing.supplier_display || "—"}>
                {costing.supplier_display || "—"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Product / Item</span>
              <p className="mt-1 text-sm font-bold text-ink truncate" title={costing.product_display || "—"}>
                {costing.product_display || "—"}
              </p>
            </div>
          </div>

          {/* Rates & Breakdown */}
          <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-3">
              Costing Rates &amp; Quantities
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-surface-sunken/40 border border-border/70 p-3">
                <span className="text-[11px] font-semibold text-ink-muted">Supplier Rate</span>
                <p className="tnum mt-1 text-base font-extrabold text-ink">
                  {formatCurrency(firstItem?.supplier_rate || "0")}
                </p>
              </div>
              <div className="rounded-lg bg-surface-sunken/40 border border-border/70 p-3">
                <span className="text-[11px] font-semibold text-ink-muted">Quantity</span>
                <p className="tnum mt-1 text-base font-extrabold text-ink">{firstItem?.quantity || "1"}</p>
              </div>
              <div className="rounded-lg bg-surface-sunken/40 border border-border/70 p-3">
                <span className="text-[11px] font-semibold text-ink-muted">Client Rate</span>
                <p className="tnum mt-1 text-base font-extrabold text-ink">
                  {formatCurrency(firstItem?.client_rate || "0")}
                </p>
              </div>
            </div>

            {/* Custom fields if present */}
            {extraEntries.length > 0 && (
              <div className="mt-3.5 pt-3 border-t border-border/60">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2 block">
                  Additional Specifications &amp; Charges
                </span>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {extraEntries.map(([key, val]) => {
                    const colConfig = costing.columns_config?.find((c) => c.key === key);
                    const label = colConfig?.label || key.replace(/_/g, " ");
                    return (
                      <div key={key} className="rounded-md bg-surface-sunken/30 border border-border/50 px-2.5 py-1.5">
                        <span className="text-[10.5px] font-medium text-ink-muted block capitalize">{label}</span>
                        <span className="text-xs font-semibold text-ink">{val || "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Financial Totals Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-surface p-3 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Supplier Cost</p>
              <p className="tnum mt-0.5 text-sm font-bold text-ink">{formatCurrency(costing.supplier_cost)}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Client Revenue</p>
              <p className="tnum mt-0.5 text-sm font-bold text-ink">{formatCurrency(costing.client_revenue)}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Net Profit</p>
              <p className={clsx("tnum mt-0.5 text-sm font-extrabold", profit >= 0 ? "text-success-700" : "text-primary-600")}>
                {formatCurrency(costing.profit)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Profit %</p>
              <p className="tnum mt-0.5 text-sm font-extrabold text-ink">{profitPercent.toFixed(1)}%</p>
            </div>
          </div>

          {/* Attached Files & Documents */}
          {allFiles.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2.5">
                Attached Documents ({allFiles.length})
              </h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {allFiles.map((f, idx) => {
                  const fPath = f.file || (f as any).file_url || "";
                  const fUrl = fPath ? (fPath.startsWith("data:") ? fPath : mediaUrl(fPath) || fPath) : "";
                  const fName = f.file_name || (fPath ? fPath.split("/").pop() : `File #${idx + 1}`);
                  const isImg = isImageFile(fName || fUrl);

                  return (
                    <div
                      key={f.id ? `modal-f-${f.id}` : `modal-f-${idx}`}
                      className="flex items-center justify-between gap-2.5 rounded-lg border border-border bg-surface-sunken/40 px-3 py-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface border border-border shadow-2xs">
                          {getFileIcon(fName || fUrl)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-ink" title={fName || undefined}>
                            {fName}
                          </p>
                          <p className="text-[10.5px] text-ink-muted">
                            {f.file_size ? formatFileSize(f.file_size) : isImg ? "Image document" : "Attached file"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isImg && fUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewLightbox(fUrl)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-ink-muted hover:text-ink hover:bg-surface-hover shadow-2xs transition-colors cursor-pointer"
                            title="Preview image"
                          >
                            <ZoomIn className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {fUrl && (
                          <a
                            href={fUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={fName || "attachment"}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-primary-600 hover:text-primary-700 hover:bg-surface-hover shadow-2xs transition-colors"
                            title="Download / Open file"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description & Remarks */}
          {costing.description && (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">
                Job Description / Remarks
              </h4>
              <p className="text-xs text-ink whitespace-pre-wrap leading-relaxed">{costing.description}</p>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-border pt-4 mt-1">
            <span className="text-[11.5px] text-ink-muted">
              Created: {formatDate(costing.created_at)} · Updated: {formatDate(costing.updated_at)}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Close
              </Button>
              {canEdit && (
                <Link href={`/costing/${costing.id}`}>
                  <Button variant="primary" className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Edit Costing
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {previewLightbox && (
        <ImageLightboxModal
          open={Boolean(previewLightbox)}
          onClose={() => setPreviewLightbox(null)}
          images={[{ image: previewLightbox, caption: "Attached Image" }]}
        />
      )}
    </>
  );
}
