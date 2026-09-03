"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { StatusBreakdownItem } from "@/lib/types";
import clsx from "clsx";

interface DonutChartProps {
  data: StatusBreakdownItem[];
  title?: string;
  size?: number;
  thickness?: number;
  valueType?: "currency" | "count";
  currencyCode?: string;
  className?: string;
}

export function DonutChart({
  data,
  title,
  size = 180,
  thickness = 22,
  valueType = "currency",
  currencyCode = "INR",
  className,
}: DonutChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const totalValue = useMemo(() => {
    return data.reduce((sum, item) => sum + (valueType === "currency" ? item.amount : item.count), 0);
  }, [data, valueType]);

  const radius = size / 2;
  const innerRadius = radius - thickness;
  const center = radius;

  const slices = useMemo(() => {
    if (totalValue === 0) return [];
    let accumulatedAngle = -Math.PI / 2; // start from top (12 o'clock)

    return data.map((item, index) => {
      const val = valueType === "currency" ? item.amount : item.count;
      const angle = (val / totalValue) * (Math.PI * 2);
      const startAngle = accumulatedAngle;
      const endAngle = accumulatedAngle + angle;
      accumulatedAngle = endAngle;

      // Arc path calculations
      const x1 = center + radius * Math.cos(startAngle);
      const y1 = center + radius * Math.sin(startAngle);
      const x2 = center + radius * Math.cos(endAngle);
      const y2 = center + radius * Math.sin(endAngle);

      const x3 = center + innerRadius * Math.cos(endAngle);
      const y3 = center + innerRadius * Math.sin(endAngle);
      const x4 = center + innerRadius * Math.cos(startAngle);
      const y4 = center + innerRadius * Math.sin(startAngle);

      const largeArc = angle > Math.PI ? 1 : 0;

      // Path definition
      const path = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
        "Z",
      ].join(" ");

      const percentage = totalValue > 0 ? (val / totalValue) * 100 : 0;

      return {
        ...item,
        value: val,
        percentage,
        path,
        index,
      };
    });
  }, [data, totalValue, radius, innerRadius, center, valueType]);

  const activeSlice = hoverIndex !== null ? slices[hoverIndex] : null;

  return (
    <div className={clsx("flex flex-col gap-4", className)}>
      {title && <h4 className="text-[14px] font-bold text-ink">{title}</h4>}

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative flex-none" style={{ width: size, height: size }}>
          {totalValue === 0 ? (
            <div
              className="flex h-full w-full items-center justify-center rounded-full border-4 border-dashed border-border text-center text-xs font-medium text-ink-faint"
            >
              No data
            </div>
          ) : (
            <>
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
                {slices.map((slice, i) => {
                  const isHovered = hoverIndex === i;
                  return (
                    <path
                      key={slice.status}
                      d={slice.path}
                      fill={slice.color}
                      opacity={hoverIndex === null || isHovered ? 1 : 0.4}
                      transform={isHovered ? `scale(1.04) translate(-${center * 0.04}, -${center * 0.04})` : undefined}
                      className="cursor-pointer transition-all duration-200"
                      onMouseEnter={() => setHoverIndex(i)}
                      onMouseLeave={() => setHoverIndex(null)}
                    />
                  );
                })}
              </svg>

              {/* Center text */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                  {activeSlice ? activeSlice.label : "Total"}
                </span>
                <span className="font-mono text-[14px] font-bold text-ink">
                  {activeSlice
                    ? valueType === "currency"
                      ? formatCurrency(activeSlice.value, currencyCode)
                      : `${activeSlice.value} items`
                    : valueType === "currency"
                    ? formatCurrency(totalValue, currencyCode)
                    : totalValue}
                </span>
                {activeSlice && (
                  <span className="text-[10.5px] font-bold text-primary-600">
                    {activeSlice.percentage.toFixed(1)}%
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Legend table */}
        <div className="flex w-full flex-col divide-y divide-border/60">
          {data.map((item, idx) => {
            const val = valueType === "currency" ? item.amount : item.count;
            const pct = totalValue > 0 ? (val / totalValue) * 100 : 0;
            const isHovered = hoverIndex === idx;

            return (
              <div
                key={item.status}
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
                className={clsx(
                  "flex items-center justify-between py-2 px-2 rounded-md transition-colors cursor-pointer",
                  isHovered ? "bg-surface-hover" : "hover:bg-surface-hover/50",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full flex-none" style={{ backgroundColor: item.color }} />
                  <span className="text-[13px] font-medium text-ink">{item.label}</span>
                </div>
                <div className="flex items-center gap-3 text-right font-mono text-[12.5px]">
                  <span className="text-ink-muted">{pct.toFixed(0)}%</span>
                  <span className="font-semibold text-ink">
                    {valueType === "currency" ? formatCurrency(item.amount, currencyCode) : `${item.count} orders`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
