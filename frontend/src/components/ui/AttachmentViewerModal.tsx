"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Table as TableIcon,
  X,
  ZoomIn,
} from "lucide-react";
import clsx from "clsx";
import * as XLSX from "xlsx";
import { mediaUrl } from "@/lib/format";
import { QuotationAttachment } from "@/lib/types";

interface AttachmentViewerModalProps {
  open: boolean;
  onClose: () => void;
  attachment: QuotationAttachment | null;
}

function dataURItoBlob(dataURI: string): Blob {
  const byteString = atob(dataURI.split(",")[1]);
  const mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentViewerModal({
  open,
  onClose,
  attachment,
}: AttachmentViewerModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Excel state
  const [excelSheets, setExcelSheets] = useState<{ name: string; rows: (string | number)[][] }[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [excelError, setExcelError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Determine file type
  const { isImg, isPdf, isExcel } = useMemo(() => {
    if (!attachment) return { isImg: false, isPdf: false, isExcel: false };
    const name = (attachment.file_name || "").toLowerCase();
    const type = (attachment.file_type || "").toLowerCase();

    const isImg =
      type === "image" ||
      /\.(png|jpe?g|webp|svg|gif)$/i.test(name) ||
      (typeof attachment.file === "string" && attachment.file.startsWith("data:image"));

    const isPdf =
      type === "pdf" ||
      /\.pdf$/i.test(name) ||
      (typeof attachment.file === "string" && attachment.file.startsWith("data:application/pdf"));

    const isExcel =
      type === "excel" ||
      /\.(xlsx|xls|csv)$/i.test(name) ||
      (typeof attachment.file === "string" &&
        (attachment.file.includes("spreadsheetml") || attachment.file.includes("ms-excel") || attachment.file.includes("text/csv")));

    return { isImg, isPdf, isExcel };
  }, [attachment]);

  // Resolve raw source URL
  const rawUrl = useMemo(() => {
    if (!attachment) return null;
    const path = attachment.file_url || (typeof attachment.file === "string" ? attachment.file : null);
    if (!path) return null;
    return path.startsWith("data:") || path.startsWith("blob:") ? path : mediaUrl(path) || path;
  }, [attachment]);

  // Load and prepare preview
  useEffect(() => {
    if (!open || !attachment || !rawUrl) {
      setBlobUrl(null);
      setExcelSheets([]);
      setExcelError(null);
      return;
    }

    setLoading(true);
    setExcelError(null);

    let active = true;

    async function preparePreview() {
      try {
        if (isPdf) {
          if (rawUrl!.startsWith("data:")) {
            const blob = dataURItoBlob(rawUrl!);
            const bUrl = URL.createObjectURL(blob);
            if (active) setBlobUrl(bUrl);
          } else {
            // Server URL: fetch as blob for smooth inline iframe rendering
            try {
              const res = await fetch(rawUrl!);
              const blob = await res.blob();
              const bUrl = URL.createObjectURL(blob);
              if (active) setBlobUrl(bUrl);
            } catch {
              if (active) setBlobUrl(rawUrl!);
            }
          }
        } else if (isExcel) {
          let wb: XLSX.WorkBook;
          if (rawUrl!.startsWith("data:")) {
            const base64 = rawUrl!.split(";base64,")[1];
            wb = XLSX.read(base64, { type: "base64" });
          } else {
            const res = await fetch(rawUrl!);
            const buffer = await res.arrayBuffer();
            wb = XLSX.read(buffer, { type: "array" });
          }

          const sheets = wb.SheetNames.map((sName) => {
            const sheet = wb.Sheets[sName];
            const rows = (XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as (string | number)[][]) || [];
            return { name: sName, rows };
          });

          if (active) {
            setExcelSheets(sheets);
            setActiveSheetIndex(0);
          }
        } else {
          // Image or other
          if (active) setBlobUrl(rawUrl!);
        }
      } catch (err) {
        console.error("Preview preparation error:", err);
        if (active) setExcelError("Could not parse file preview. Please download to view.");
      } finally {
        if (active) setLoading(false);
      }
    }

    preparePreview();

    return () => {
      active = false;
    };
  }, [open, attachment, rawUrl, isPdf, isExcel]);

  const handleDownload = () => {
    if (!rawUrl || !attachment) return;
    const a = document.createElement("a");
    a.href = blobUrl || rawUrl;
    a.download = attachment.file_name || "document";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenExternal = () => {
    if (!rawUrl) return;
    window.open(blobUrl || rawUrl, "_blank");
  };

  if (!open || !mounted || !attachment) return null;

  const currentExcelSheet = excelSheets[activeSheetIndex];
  const excelRows = currentExcelSheet?.rows || [];
  const maxCols = excelRows.reduce((max, r) => Math.max(max, r.length), 0);
  const headerRow = excelRows[0] || [];
  const bodyRows = excelRows.slice(1);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-5xl rounded-xl border border-border bg-surface shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-sunken/40 px-5 py-3.5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {isImg ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
                <ImageIcon className="h-5 w-5" />
              </div>
            ) : isPdf ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
                <FileText className="h-5 w-5" />
              </div>
            ) : isExcel ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-ink-muted border border-border">
                <TableIcon className="h-5 w-5" />
              </div>
            )}

            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink truncate" title={attachment.file_name}>
                {attachment.file_name}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-ink-muted">
                {attachment.file_size ? <span>{formatFileSize(attachment.file_size)}</span> : null}
                {attachment.file_type && (
                  <span className="font-semibold uppercase tracking-wider text-primary-600">
                    • {attachment.file_type}
                  </span>
                )}
                {isExcel && excelRows.length > 0 && (
                  <span>• {excelRows.length} rows</span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white text-xs font-semibold text-ink hover:bg-neutral-50 hover:text-primary-600 hover:border-primary-300 transition-colors shadow-2xs cursor-pointer"
              title="Download file"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={handleOpenExternal}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white text-xs font-semibold text-ink hover:bg-neutral-50 hover:text-primary-600 hover:border-primary-300 transition-colors shadow-2xs cursor-pointer"
              title="Open in new window"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Tab</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-neutral-100 hover:text-ink transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="relative flex-1 overflow-auto bg-neutral-100/50 p-2 sm:p-4 min-h-[450px]">
          {loading ? (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-2 text-ink-muted">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              <p className="text-xs font-semibold">Loading file preview...</p>
            </div>
          ) : isPdf ? (
            <div className="h-full w-full">
              {blobUrl ? (
                <iframe
                  src={blobUrl}
                  className="h-[75vh] w-full rounded-lg border border-border bg-white shadow-xs"
                  title={attachment.file_name}
                />
              ) : (
                <div className="flex h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
                  <p className="text-sm font-medium text-ink">Preview not available in this browser.</p>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-700"
                  >
                    <Download className="h-4 w-4" /> Download PDF File
                  </button>
                </div>
              )}
            </div>
          ) : isExcel ? (
            <div className="flex flex-col gap-3">
              {excelError ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-xs text-amber-800">
                  <p className="font-semibold">{excelError}</p>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    <Download className="h-3.5 w-3.5" /> Download Spreadsheet
                  </button>
                </div>
              ) : (
                <>
                  {/* Sheet Tabs */}
                  {excelSheets.length > 1 && (
                    <div className="flex items-center gap-1 border-b border-border overflow-x-auto pb-1">
                      {excelSheets.map((s, sIdx) => (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => setActiveSheetIndex(sIdx)}
                          className={clsx(
                            "px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer border-b-2",
                            activeSheetIndex === sIdx
                              ? "border-primary-600 text-primary-700 bg-white shadow-2xs font-bold"
                              : "border-transparent text-ink-muted hover:text-ink hover:bg-surface"
                          )}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Excel Sheet Table */}
                  <div className="w-full overflow-auto max-h-[70vh] rounded-lg border border-border bg-white shadow-xs">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="sticky top-0 z-10 border-b border-border bg-neutral-100 font-bold text-ink">
                          <th className="w-10 border-r border-border bg-neutral-200/80 px-2.5 py-2 text-center font-mono text-[11px] text-ink-muted">
                            #
                          </th>
                          {Array.from({ length: maxCols }).map((_, colIdx) => (
                            <th
                              key={colIdx}
                              className="border-r border-border bg-neutral-100 px-3 py-2 font-bold text-ink whitespace-nowrap text-xs last:border-r-0"
                            >
                              {headerRow[colIdx] !== undefined && headerRow[colIdx] !== null && String(headerRow[colIdx]).trim() !== ""
                                ? String(headerRow[colIdx])
                                : String.fromCharCode(65 + (colIdx % 26))}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bodyRows.length === 0 ? (
                          <tr>
                            <td colSpan={maxCols + 1} className="p-8 text-center text-xs text-ink-muted">
                              This sheet is empty.
                            </td>
                          </tr>
                        ) : (
                          bodyRows.map((row, rIdx) => (
                            <tr
                              key={rIdx}
                              className="border-b border-border/70 hover:bg-neutral-50 transition-colors"
                            >
                              <td className="border-r border-border/70 bg-neutral-50 px-2.5 py-1.5 text-center font-mono text-[10.5px] text-ink-muted">
                                {rIdx + 2}
                              </td>
                              {Array.from({ length: maxCols }).map((_, cIdx) => (
                                <td
                                  key={cIdx}
                                  className="border-r border-border/70 px-3 py-1.5 text-ink whitespace-nowrap text-xs font-medium last:border-r-0"
                                >
                                  {row[cIdx] !== undefined && row[cIdx] !== null ? String(row[cIdx]) : ""}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : isImg ? (
            <div className="flex min-h-[500px] max-h-[75vh] items-center justify-center overflow-auto rounded-lg bg-neutral-900/90 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={blobUrl || rawUrl || ""}
                alt={attachment.file_name}
                className="max-h-[70vh] max-w-full rounded object-contain shadow-lg"
              />
            </div>
          ) : (
            <div className="flex h-[400px] flex-col items-center justify-center gap-3 text-center">
              <TableIcon className="h-10 w-10 text-ink-muted" />
              <p className="text-sm font-semibold text-ink">Preview not available for this format.</p>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-700"
              >
                <Download className="h-4 w-4" /> Download File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

