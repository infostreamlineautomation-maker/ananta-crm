"use client";

import clsx from "clsx";

export function ClientNameDisplay({
  clientName,
  companyName,
  fallback = "—",
  inline = false,
  className,
  companyClassName,
}: {
  clientName?: string | null;
  companyName?: string | null;
  fallback?: string;
  inline?: boolean;
  className?: string;
  companyClassName?: string;
}) {
  if (!clientName && !companyName) {
    return <span className="text-ink-muted">{fallback}</span>;
  }

  return (
    <div className={clsx("flex items-center gap-1.5 flex-wrap", !inline && "min-w-0", className)}>
      <span className="font-semibold text-ink">{clientName || fallback}</span>
      {companyName && (
        <span className={clsx("text-[12px] font-medium text-ink-muted", companyClassName)}>
          ({companyName})
        </span>
      )}
    </div>
  );
}
