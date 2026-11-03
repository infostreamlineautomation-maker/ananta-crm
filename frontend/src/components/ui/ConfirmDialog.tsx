"use client";

import { AlertTriangle, CheckCircle2, HelpCircle, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  variant,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger" | "secondary";
  loading?: boolean;
}) {
  const isDelete =
    variant === "danger" ||
    (!variant &&
      (title.toLowerCase().includes("delete") ||
        title.toLowerCase().includes("remove") ||
        title.toLowerCase().includes("discard") ||
        (confirmLabel && confirmLabel.toLowerCase().includes("delete"))));

  const resolvedConfirmLabel = confirmLabel || (isDelete ? "Delete" : "Confirm");
  const resolvedVariant = variant || (isDelete ? "danger" : "primary");

  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-md">
      <div className="flex items-start gap-3.5 py-1">
        <div
          className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${
            isDelete ? "bg-rose-50 text-rose-600" : "bg-primary-50 text-primary-600"
          }`}
        >
          {isDelete ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <HelpCircle className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-[13.5px] leading-relaxed text-ink-muted">{description}</p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2.5 pt-2 border-t border-border/60">
        <Button variant="secondary" onClick={onClose} disabled={loading} size="sm">
          {cancelLabel}
        </Button>
        <Button variant={resolvedVariant} onClick={onConfirm} loading={loading} size="sm">
          {resolvedConfirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
