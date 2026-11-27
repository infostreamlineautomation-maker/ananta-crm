import clsx from "clsx";

export type Tone = "neutral" | "success" | "warning" | "info" | "danger";

export interface StatusOption {
  value: string;
  label: string;
  tone?: Tone;
}

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-ink-muted",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  info: "bg-info-50 text-info-700",
  danger: "bg-primary-50 text-primary-600",
};

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        TONE_CLASSES[tone],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export const DELIVERY_STATUS_TONE: Record<string, Tone> = {
  pending: "neutral",
  in_process: "warning",
  ready: "info",
  delivered: "success",
};

export const PAYMENT_STATUS_TONE: Record<string, Tone> = {
  pending: "warning",
  advance: "info",
  partial: "info",
  paid: "success",
};

export const QUOTATION_STATUS_TONE: Record<string, Tone> = {
  draft: "neutral",
  sent: "info",
  accepted: "success",
  rejected: "danger",
  revision_requested: "warning",
};

export const PROJECT_STATUS_TONE: Record<string, Tone> = {
  active: "success",
  on_hold: "warning",
  completed: "info",
  cancelled: "danger",
};

export const DELIVERY_STATUS_OPTIONS: StatusOption[] = [
  { value: "pending", label: "Pending", tone: "neutral" },
  { value: "in_process", label: "In Process", tone: "warning" },
  { value: "ready", label: "Ready", tone: "info" },
  { value: "delivered", label: "Delivered", tone: "success" },
];

export const PAYMENT_STATUS_OPTIONS: StatusOption[] = [
  { value: "pending", label: "Pending", tone: "warning" },
  { value: "advance", label: "Advance", tone: "info" },
  { value: "partial", label: "Partial", tone: "info" },
  { value: "paid", label: "Paid", tone: "success" },
];

export const QUOTATION_STATUS_OPTIONS: StatusOption[] = [
  { value: "draft", label: "Draft", tone: "neutral" },
  { value: "sent", label: "Sent", tone: "info" },
  { value: "accepted", label: "Accepted", tone: "success" },
  { value: "revision_requested", label: "Revision Requested", tone: "warning" },
  { value: "rejected", label: "Rejected", tone: "danger" },
];

export const PROJECT_STATUS_OPTIONS: StatusOption[] = [
  { value: "active", label: "Active", tone: "success" },
  { value: "on_hold", label: "On Hold", tone: "warning" },
  { value: "completed", label: "Completed", tone: "info" },
  { value: "cancelled", label: "Cancelled", tone: "danger" },
];

export const USER_STATUS_OPTIONS: StatusOption[] = [
  { value: "active", label: "Active", tone: "success" },
  { value: "inactive", label: "Inactive", tone: "neutral" },
];

export function labelize(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
