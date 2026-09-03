"use client";

import { formatCurrency } from "@/lib/format";
import clsx from "clsx";

interface ProgressItem {
  name: string;
  value: number;
  subValue?: string;
  share_pct: number;
}

interface ProgressBarListProps {
  items: ProgressItem[];
  valueType?: "currency" | "number";
  currencyCode?: string;
  emptyLabel?: string;
  barColor?: string;
  className?: string;
}

export function ProgressBarList({
  items,
  valueType = "currency",
  currencyCode = "INR",
  emptyLabel = "No data available",
  barColor = "#c31432",
  className,
}: ProgressBarListProps) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-faint">{emptyLabel}</p>;
  }

  const maxVal = Math.max(1, ...items.map((it) => it.value));

  return (
    <div className={clsx("flex flex-col gap-3.5", className)}>
      {items.map((item, index) => {
        const widthPct = Math.max(4, Math.min(100, (item.value / maxVal) * 100));

        return (
          <div key={item.name + index} className="group flex flex-col gap-1">
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-surface-sunken font-mono text-[10px] font-bold text-ink-muted">
                  {index + 1}
                </span>
                <span className="truncate font-semibold text-ink group-hover:text-primary-600 transition-colors">
                  {item.name}
                </span>
                {item.subValue && <span className="text-[11.5px] text-ink-faint">({item.subValue})</span>}
              </div>

              <div className="flex items-center gap-2 flex-none pl-2">
                <span className="font-mono text-[12px] font-bold text-ink">
                  {valueType === "currency" ? formatCurrency(item.value, currencyCode) : item.value.toLocaleString("en-IN")}
                </span>
                <span className="font-mono text-[11px] text-ink-muted w-10 text-right">
                  {item.share_pct.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: barColor,
                  opacity: 0.85,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
