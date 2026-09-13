"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Package, X } from "lucide-react";
import clsx from "clsx";

export function ItemsDropdown({
  items,
  maxDisplayWidth = "max-w-[130px]",
  title = "Products",
  icon: Icon = Package,
}: {
  items: string[];
  maxDisplayWidth?: string;
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const cleanItems = items.map((i) => i.trim()).filter(Boolean);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = 240;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 16) {
        left = window.innerWidth - popoverWidth - 16;
      }
      if (left < 16) left = 16;

      let top = rect.bottom + 6;
      const popoverHeight = Math.min(260, cleanItems.length * 36 + 60);
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
  }, [open, cleanItems.length]);

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

  if (cleanItems.length === 0) {
    return <span className="text-ink-faint">—</span>;
  }

  const first = cleanItems[0];

  if (cleanItems.length === 1) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-sunken/60 px-2 py-1 text-[11.5px] font-semibold text-ink shadow-2xs whitespace-nowrap"
        title={first}
      >
        <Icon className="h-3.5 w-3.5 text-primary-600 shrink-0" />
        <span className={clsx("truncate", maxDisplayWidth)}>{first}</span>
      </span>
    );
  }

  const extraCount = cleanItems.length - 1;

  const popoverMenu =
    open && mounted && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popoverRef}
            onClick={(e) => e.stopPropagation()}
            style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
            className="fixed z-[99999] w-64 rounded-xl border border-border bg-surface p-2.5 shadow-2xl ring-1 ring-black/10 animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="flex items-center justify-between border-b border-border/70 pb-2 mb-2 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-primary-600" />
                {title} ({cleanItems.length})
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-[220px] overflow-y-auto space-y-1 py-0.5 px-0.5">
              {cleanItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg border border-border/40 bg-surface-sunken/30 px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100/70 text-[10px] font-bold text-primary-700">
                    {idx + 1}
                  </span>
                  <span className="truncate" title={item}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      {/* Primary item pill */}
      <span
        className="inline-flex items-center gap-1.5 rounded-l-md border border-border bg-surface-sunken/60 px-2 py-1 text-[11.5px] font-semibold text-ink shadow-2xs border-r-0 whitespace-nowrap"
        title={first}
      >
        <Icon className="h-3.5 w-3.5 text-primary-600 shrink-0" />
        <span className={clsx("truncate", maxDisplayWidth)}>{first}</span>
      </span>

      {/* Dropdown toggle for additional items */}
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
        title={`${cleanItems.length} products. Click to view list.`}
      >
        <span>+{extraCount}</span>
        <ChevronDown className={clsx("h-3 w-3 transition-transform duration-150", open && "rotate-180 text-primary-600")} />
      </button>

      {popoverMenu}
    </div>
  );
}
