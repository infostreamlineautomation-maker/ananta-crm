import clsx from "clsx";

type Tone = "neutral" | "success" | "warning" | "info" | "danger";

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
  partial: "info",
  paid: "success",
};

export const QUOTATION_STATUS_TONE: Record<string, Tone> = {
  draft: "neutral",
  sent: "info",
  accepted: "success",
  rejected: "danger",
};

export const PROJECT_STATUS_TONE: Record<string, Tone> = {
  active: "success",
  on_hold: "warning",
  completed: "info",
  cancelled: "danger",
};

export function labelize(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
