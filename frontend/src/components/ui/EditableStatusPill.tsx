"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Check, Loader2 } from "lucide-react";
import { StatusOption, StatusPill, labelize } from "./StatusPill";

export interface EditableStatusPillProps {
  value: string;
  options: readonly StatusOption[];
  canEdit?: boolean;
  onChange: (newValue: string) => Promise<void> | void;
  title?: string;
  align?: "left" | "center" | "right";
  customLabel?: string;
  className?: string;
}

export function EditableStatusPill({
  value,
  options,
  canEdit = false,
  onChange,
  title = "Click to update status",
  align = "left",
  customLabel,
  className,
}: EditableStatusPillProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; openUp: boolean }>({
    top: 0,
    left: 0,
    openUp: false,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentOption = options.find((opt) => opt.value === value);
  const displayLabel = customLabel ?? currentOption?.label ?? labelize(value);
  const currentTone = currentOption?.tone ?? "neutral";

  const updatePosition = () => {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 200;
    const estimatedHeight = Math.min(options.length * 36 + 16, 260);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight + 12 && rect.top > estimatedHeight + 12;

    let left = rect.left;
    if (align === "right") {
      left = rect.right - menuWidth;
    } else if (align === "center") {
      left = rect.left + rect.width / 2 - menuWidth / 2;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

    setCoords({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      left,
      openUp,
    });
  };

  useLayoutEffect(() => {
    if (open) {
      updatePosition();
    }
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    const handleScrollOrResize = (e: Event) => {
      if (e.target && menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  if (!canEdit) {
    return <StatusPill label={displayLabel} tone={currentTone} />;
  }

  async function handleSelect(newValue: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    if (newValue === value || saving) return;

    setSaving(true);
    try {
      await onChange(newValue);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={saving}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!saving) setOpen((prev) => !prev);
        }}
        title={title}
        className={clsx(
          "group relative inline-flex items-center gap-1.5 transition-all cursor-pointer hover:opacity-90 active:scale-95 text-left disabled:cursor-wait disabled:opacity-75",
          className
        )}
      >
        <StatusPill label={displayLabel} tone={currentTone} />
        {saving ? (
          <Loader2 className="h-3 w-3 animate-spin text-primary-600 shrink-0" />
        ) : (
          <span
            className={clsx(
              "transition-opacity text-[10px] text-primary-600 underline font-semibold shrink-0",
              open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            Edit
          </span>
        )}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            style={{
              top: coords.top,
              left: coords.left,
              transform: coords.openUp ? "translateY(-100%)" : undefined,
            }}
            className="fixed z-[9999] w-[200px] rounded-xl border border-border bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
              Update Status
            </div>
            <div className="flex flex-col gap-0.5 mt-0.5 max-h-[220px] overflow-y-auto">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={(e) => handleSelect(opt.value, e)}
                    className={clsx(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors cursor-pointer",
                      isSelected ? "bg-primary-50/70" : "hover:bg-surface-hover"
                    )}
                  >
                    <StatusPill label={opt.label} tone={opt.tone} />
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
