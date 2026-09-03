"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function SlideOver({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // Portal, not inline — see Modal.tsx for why (avoids nesting inside a
  // page-level <form> when this wraps a form of its own, e.g. ClientForm).
  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-[var(--shadow-pop)]">
        <div className="flex flex-none items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-surface-sunken hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-none items-center justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
