"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
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
import { CostingDetail, CostingFile, QuotationAttachment } from "@/lib/types";
import { formatCurrency, formatDate, mediaUrl } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AttachmentViewerModal } from "@/components/ui/AttachmentViewerModal";

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
  const [previewAttachment, setPreviewAttachment] = useState<QuotationAttachment | null>(null);

  if (!costing) return null;

  const profit = parseFloat(costing.profit || "0");
  const profitPercent = parseFloat(costing.profit_percent || "0");

  const allFiles: CostingFile[] =
    costing.files && costing.files.length > 0
      ? costing.files
      : costing.file
      ? [{ file: costing.file, file_name: costing.file_name, category: "catalogue" }]
      : [];

  const catalogueFiles = allFiles.filter((f) => f.category !== "rate_list");
  const rateListFiles = allFiles.filter((f) => f.category === "rate_list");

  const renderFileCard = (f: CostingFile, idx: number, prefix: string) => {
    const fPath = f.file || (f as any).file_url || "";
    const fUrl = fPath ? (fPath.startsWith("data:") ? fPath : mediaUrl(fPath) || fPath) : "";
    const fName = f.file_name || (fPath ? fPath.split("/").pop() : `File #${idx + 1}`);
    const isImg = isImageFile(fName || fUrl);

    return (
      <div
        key={f.id ? `${prefix}-f-${f.id}` : `${prefix}-f-${idx}`}
        className="flex items-center justify-between gap-2.5 rounded-lg border border-border bg-surface px-3 py-2 shadow-2xs"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken border border-border shadow-2xs">
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
          {fPath ? (
            <button
              type="button"
              onClick={() => {
                const ext = (fName || fPath).split(".").pop()?.toLowerCase() || "";
                const fileType = isImg
                  ? "image"
                  : ext === "pdf"
                  ? "pdf"
                  : ["xlsx", "xls", "csv"].includes(ext)
                  ? "excel"
                  : "other";
                setPreviewAttachment({
                  id: f.id,
                  file: f.file ?? null,
                  file_url: (f as any).file_url ?? null,
                  file_name: fName || "attachment",
                  file_size: f.file_size ?? undefined,
                  file_type: fileType,
                });
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-ink-muted hover:text-ink hover:bg-surface-hover shadow-2xs transition-colors cursor-pointer"
              title="Preview attachment"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {fUrl && (
            <a
              href={fUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={fName || "attachment"}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-primary-600 hover:text-primary-700 hover:bg-surface-hover shadow-2xs transition-colors"
              title="Download file"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={`Costing Sheet #${costing.id}`} width="max-w-4xl">
        <div className="flex flex-col gap-5">
          {/* Header summary badge banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-sunken/30 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 border border-primary-100 dark:border-primary-900">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-ink">
                  {costing.client_display || "Costing Sheet"}
                  {costing.company_name && (
                    <span className="ml-1.5 text-sm font-medium text-ink-muted">({costing.company_name})</span>
                  )}
                </h3>
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
              <p
                className="mt-1 text-sm font-bold text-ink truncate"
                title={costing.company_name ? `${costing.client_display} (${costing.company_name})` : costing.client_display || "—"}
              >
                {costing.client_display || "—"}
                {costing.company_name && (
                  <span className="ml-1 text-xs font-medium text-ink-muted">({costing.company_name})</span>
                )}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Supplier / Vendor</span>
              <p className="mt-1 text-sm font-bold text-ink truncate" title={costing.supplier_display || "—"}>
                {costing.supplier_display || "—"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Product(s)</span>
              <p
                className="mt-1 text-sm font-bold text-ink truncate"
                title={costing.product_names || costing.product_display || "—"}
              >
                {costing.product_names || costing.product_display || "—"}
              </p>
            </div>
          </div>

          {/* Items & Rates Table */}
          <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Costing Items &amp; Specifications ({costing.items?.length || 0})
              </h4>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border/80">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-sunken/70 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                    <th className="w-10 px-3 py-2 text-center">#</th>
                    <th className="px-3 py-2">Product &amp; Description</th>
                    {costing.columns_config?.map((col) => (
                      <th key={col.key} className="px-3 py-2">
                        {col.label}
                      </th>
                    ))}
                    <th className="w-20 px-3 py-2 text-right">Qty</th>
                    <th className="w-24 px-3 py-2 text-right">Supplier Rate</th>
                    <th className="w-28 px-3 py-2 text-right">Supplier Total</th>
                    <th className="w-24 px-3 py-2 text-right">Client Rate</th>
                    <th className="w-28 px-3 py-2 text-right">Client Total</th>
                    <th className="w-28 px-3 py-2 text-right">Profit / %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {(costing.items || []).map((item, idx) => {
                    const qty = Number(item.quantity || 0);
                    const sRate = Number(item.supplier_rate || 0);
                    const cRate = Number(item.client_rate || 0);
                    const hasCRate = cRate > 0;
                    const sTotal = qty * sRate;
                    const cTotal = qty * cRate;
                    const rowProfit = cTotal - sTotal;
                    const rowPct = sTotal > 0 ? (rowProfit / sTotal) * 100 : 0;
                    const prodName = item.product_name || (idx === 0 ? costing.product_display : "") || "";

                    return (
                      <tr key={item.id || idx} className="hover:bg-surface-hover/50">
                        <td className="px-3 py-2.5 text-center font-mono text-ink-muted">{idx + 1}</td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-ink">{prodName || "—"}</div>
                          {item.description && (
                            <div className="text-[11px] italic text-ink-muted whitespace-pre-line mt-0.5">
                              {item.description}
                            </div>
                          )}
                        </td>
                        {costing.columns_config?.map((col) => (
                          <td key={col.key} className="px-3 py-2.5 text-ink-muted">
                            {item.extra_data?.[col.key] || item.extra_data?.[col.label] || "—"}
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right tnum font-medium text-ink">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-right tnum text-ink-muted">{formatCurrency(sRate)}</td>
                        <td className="px-3 py-2.5 text-right tnum font-semibold text-ink">{formatCurrency(sTotal)}</td>
                        <td className="px-3 py-2.5 text-right tnum text-ink-muted">
                          {hasCRate ? formatCurrency(cRate) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tnum font-semibold text-ink">
                          {hasCRate ? formatCurrency(cTotal) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tnum whitespace-nowrap">
                          {hasCRate ? (
                            <span className={clsx("font-bold", rowProfit >= 0 ? "text-success-700" : "text-primary-600")}>
                              {formatCurrency(rowProfit)}{" "}
                              <span className="text-[10px] font-semibold">({rowPct.toFixed(1)}%)</span>
                            </span>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

          {/* Attached Files & Documents (Catalogue & Rate List) */}
          {allFiles.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-border/70 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Attached Documents ({allFiles.length})
                </h4>
              </div>

              {/* Catalogue Section */}
              {catalogueFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary-700">
                    <BookOpen className="h-3.5 w-3.5 text-primary-600" />
                    <span>Catalogue / Samples ({catalogueFiles.length})</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {catalogueFiles.map((f, idx) => renderFileCard(f, idx, "view-cat"))}
                  </div>
                </div>
              )}

              {/* Rate List Section */}
              {rateListFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Rate List / Price Sheet ({rateListFiles.length})</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {rateListFiles.map((f, idx) => renderFileCard(f, idx, "view-rate"))}
                  </div>
                </div>
              )}
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

      <AttachmentViewerModal
        open={Boolean(previewAttachment)}
        onClose={() => setPreviewAttachment(null)}
        attachment={previewAttachment}
      />
    </>
  );
}
