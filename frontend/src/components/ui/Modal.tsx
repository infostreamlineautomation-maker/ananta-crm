"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import clsx from "clsx";

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
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

  // Rendered via a portal, not inline — this can be opened from inside a
  // page-level <form> (e.g. the "+ Add new client" fast-track flow), and an
  // inline render would nest it inside that form's DOM subtree. Nested
  // <form> elements are invalid HTML; the browser silently merges them, so a
  // submit button inside the modal would submit the *outer* form instead.
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className={clsx("relative w-full rounded-lg border border-border bg-surface shadow-[var(--shadow-pop)]", width)}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-surface-sunken hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[88vh] overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
