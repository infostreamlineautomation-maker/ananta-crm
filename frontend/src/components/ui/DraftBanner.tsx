"use client";

import { useState } from "react";
import { History, Trash2, X } from "lucide-react";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";

interface DraftBannerProps {
  savedAt: Date | null;
  onDiscard: () => void;
  onDismiss: () => void;
}

function formatDraftTime(d: Date | null): string {
  if (!d) return "earlier session";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "just now";
  if (diffMins === 1) return "1 minute ago";
  if (diffMins < 60) return `${diffMins} minutes ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  return d.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DraftBanner({ savedAt, onDiscard, onDismiss }: DraftBannerProps) {
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-amber-300/80 bg-amber-50/90 text-amber-900 shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-200/70 text-amber-800 shrink-0">
            <History className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-950">
              Unsaved Draft Restored
            </p>
            <p className="text-[11.5px] text-amber-800">
              Preserved in-progress changes from {formatDraftTime(savedAt)}. Your filled data was saved locally.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setConfirmDiscardOpen(true)}
            className="h-7 px-2.5 text-xs text-rose-700 hover:text-rose-800 hover:bg-rose-50 border-amber-300 gap-1.5"
          >
            <Trash2 className="h-3 w-3" /> Discard
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={onDismiss}
            className="h-7 px-3 text-xs bg-amber-800 hover:bg-amber-900 text-white"
          >
            Keep Draft
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDiscardOpen}
        onClose={() => setConfirmDiscardOpen(false)}
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          onDiscard();
        }}
        title="Discard Unsaved Draft?"
        description="Are you sure you want to discard your unsaved draft? All filled fields will be reset back to the initial form values."
        confirmLabel="Yes, Discard Draft"
        variant="danger"
      />
    </>
  );
}

