"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Paperclip,
  X,
} from "lucide-react";
import clsx from "clsx";
import { mediaUrl } from "@/lib/format";

export interface AttachmentItem {
  id?: number;
  file?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  category?: "catalogue" | "rate_list" | string;
}

function getFileIcon(name?: string | null) {
  const ext = name?.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) {
    return <FileText className="h-3.5 w-3.5 text-rose-600 shrink-0" />;
  }
  if (["xlsx", "xls", "csv"].includes(ext)) {
    return <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 shrink-0" />;
  }
  if (["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext)) {
    return <ImageIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />;
  }
  return <Paperclip className="h-3.5 w-3.5 text-primary-600 shrink-0" />;
}

function formatFileSize(bytes?: number | null) {
  if (!bytes || isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentDropdown({
  files,
  maxDisplayWidth = "max-w-[130px]",
}: {
  files?: AttachmentItem[] | null;
  maxDisplayWidth?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const cleanFiles = (files || []).filter((f) => Boolean(f.file || f.file_url));
  const catalogueFiles = cleanFiles.filter((f) => f.category !== "rate_list");
  const rateListFiles = cleanFiles.filter((f) => f.category === "rate_list");
  const hasBothCategories = catalogueFiles.length > 0 && rateListFiles.length > 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = hasBothCategories ? 540 : 280;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 16) {
        left = window.innerWidth - popoverWidth - 16;
      }
      if (left < 16) left = 16;

      let top = rect.bottom + 6;
      const maxRows = Math.max(catalogueFiles.length, rateListFiles.length);
      const popoverHeight = Math.min(320, maxRows * 44 + 80);
      if (top + popoverHeight > window.innerHeight && rect.top > popoverHeight) {
        top = Math.max(16, rect.top - popoverHeight - 6);
      }

      setPos({ top, left });
    }
  };

  useEffect(() => {
    if (open) {
      updatePosition();
    }
  }, [open, hasBothCategories, catalogueFiles.length, rateListFiles.length]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleScrollOrResize() {
      updatePosition();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  if (cleanFiles.length === 0) {
    return <span className="text-ink-muted">—</span>;
  }

  const first = cleanFiles[0];
  const firstPath = first.file || first.file_url || "";
  const firstUrl = firstPath ? (firstPath.startsWith("data:") ? firstPath : mediaUrl(firstPath) || firstPath) : "#";
  const firstFileName = first.file_name || (firstPath ? firstPath.split("/").pop() : "Attachment");

  if (cleanFiles.length === 1) {
    return (
      <a
        href={firstUrl}
        target="_blank"
        rel="noopener noreferrer"
        download={firstFileName || "attachment"}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-sunken/60 hover:bg-surface px-2 py-1 text-[11.5px] font-medium text-ink hover:border-primary-400 hover:text-primary-600 transition-colors shadow-2xs"
        title={`Download / View: ${firstFileName}`}
      >
        {getFileIcon(firstFileName)}
        <span className={clsx("truncate", maxDisplayWidth)}>{firstFileName}</span>
      </a>
    );
  }

  const extraCount = cleanFiles.length - 1;

  const renderFileRow = (f: AttachmentItem, idx: number, prefix: string) => {
    const path = f.file || f.file_url || "";
    const url = path ? (path.startsWith("data:") ? path : mediaUrl(path) || path) : "#";
    const name = f.file_name || (path ? path.split("/").pop() : `File #${idx + 1}`);

    return (
      <a
        key={f.id ? `${prefix}-f-${f.id}` : `${prefix}-f-${idx}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        download={name || "attachment"}
        onClick={() => setOpen(false)}
        className="flex items-center justify-between gap-2.5 rounded-lg border border-transparent hover:border-border hover:bg-surface-hover p-1.5 text-xs text-ink transition-colors group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-sunken border border-border/60">
            {getFileIcon(name)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink group-hover:text-primary-600 text-xs" title={name}>
              {name}
            </p>
            {f.file_size ? <p className="text-[10px] text-ink-muted">{formatFileSize(f.file_size)}</p> : null}
          </div>
        </div>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-surface border border-border/60 text-ink-muted group-hover:text-primary-600 group-hover:border-primary-300 transition-colors shadow-2xs">
          <Download className="h-3 w-3" />
        </div>
      </a>
    );
  };

  const popoverMenu =
    open && mounted && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popoverRef}
            onClick={(e) => e.stopPropagation()}
            style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
            className={clsx(
              "fixed z-[99999] rounded-xl border border-border bg-surface p-3 shadow-2xl ring-1 ring-black/10 animate-in fade-in zoom-in-95 duration-100",
              hasBothCategories ? "w-[540px]" : "w-72"
            )}
          >
            <div className="flex items-center justify-between border-b border-border/70 pb-2 mb-2.5 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                All Attachments ({cleanFiles.length})
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {hasBothCategories ? (
              <div className="grid grid-cols-2 divide-x divide-border/60 gap-3">
                {/* Left Section: Catalogue */}
                <div className="flex flex-col min-w-0 pr-1">
                  <div className="flex items-center gap-1.5 px-1 pb-1.5 mb-1.5 border-b border-border/40 text-[10.5px] font-bold uppercase tracking-wider text-primary-700">
                    <BookOpen className="h-3 w-3 text-primary-600" />
                    <span>Catalogue ({catalogueFiles.length})</span>
                  </div>
                  <div className="max-h-[260px] overflow-y-auto space-y-1">
                    {catalogueFiles.map((f, idx) => renderFileRow(f, idx, "cat"))}
                  </div>
                </div>

                {/* Right Section: Rate List */}
                <div className="flex flex-col min-w-0 pl-3">
                  <div className="flex items-center gap-1.5 px-1 pb-1.5 mb-1.5 border-b border-border/40 text-[10.5px] font-bold uppercase tracking-wider text-emerald-700">
                    <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
                    <span>Rate List ({rateListFiles.length})</span>
                  </div>
                  <div className="max-h-[260px] overflow-y-auto space-y-1">
                    {rateListFiles.map((f, idx) => renderFileRow(f, idx, "rate"))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto space-y-1 px-0.5">
                {catalogueFiles.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 px-1 pb-1.5 mb-1.5 border-b border-border/40 text-[10.5px] font-bold uppercase tracking-wider text-primary-700">
                      <BookOpen className="h-3 w-3 text-primary-600" />
                      <span>Catalogue ({catalogueFiles.length})</span>
                    </div>
                    <div className="space-y-1">
                      {catalogueFiles.map((f, idx) => renderFileRow(f, idx, "cat"))}
                    </div>
                  </div>
                )}
                {rateListFiles.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 px-1 pb-1.5 mb-1.5 border-b border-border/40 text-[10.5px] font-bold uppercase tracking-wider text-emerald-700">
                      <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
                      <span>Rate List ({rateListFiles.length})</span>
                    </div>
                    <div className="space-y-1">
                      {rateListFiles.map((f, idx) => renderFileRow(f, idx, "rate"))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      {/* Primary file pill */}
      <a
        href={firstUrl}
        target="_blank"
        rel="noopener noreferrer"
        download={firstFileName || "attachment"}
        className="inline-flex items-center gap-1.5 rounded-l-md border border-border bg-surface-sunken/60 hover:bg-surface px-2 py-1 text-[11.5px] font-medium text-ink hover:border-primary-400 hover:text-primary-600 transition-colors shadow-2xs border-r-0"
        title={`Download / View: ${firstFileName}`}
      >
        {getFileIcon(firstFileName)}
        <span className={clsx("truncate", maxDisplayWidth)}>{firstFileName}</span>
      </a>

      {/* Dropdown toggle for additional files */}
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={clsx(
          "inline-flex items-center gap-0.5 rounded-r-md border border-border px-1.5 py-1 text-[11px] font-bold transition-colors shadow-2xs cursor-pointer",
          open
            ? "bg-primary-50 text-primary-700 border-primary-400"
            : "bg-surface-sunken/80 text-ink-muted hover:text-ink hover:bg-surface hover:border-primary-400"
        )}
        title={`${cleanFiles.length} attachments. Click to view list.`}
      >
        <span>+{extraCount}</span>
        <ChevronDown className={clsx("h-3 w-3 transition-transform duration-150", open && "rotate-180 text-primary-600")} />
      </button>

      {popoverMenu}
    </div>
  );
}
