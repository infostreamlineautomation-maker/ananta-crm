"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { TimeSeriesPoint } from "@/lib/types";
import clsx from "clsx";

interface AreaTrendChartProps {
  data: TimeSeriesPoint[];
  height?: number;
  currencyCode?: string;
  className?: string;
}

export function AreaTrendChart({ data, height = 240, currencyCode = "INR", className }: AreaTrendChartProps) {
  const [metric, setMetric] = useState<"revenue" | "paid" | "orders_count">("revenue");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const points = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((d) => ({
      ...d,
      value: d[metric],
    }));
  }, [data, metric]);

  const { maxValue, svgPoints, areaPath, linePath } = useMemo(() => {
    if (points.length === 0) {
      return { maxValue: 0, svgPoints: [], areaPath: "", linePath: "" };
    }

    const max = Math.max(1, ...points.map((p) => p.value));
    const paddingX = 20;
    const paddingY = 24;
    const chartWidth = 700;
    const chartHeight = height;

    const usableWidth = chartWidth - paddingX * 2;
    const usableHeight = chartHeight - paddingY * 2;

    const coords = points.map((p, i) => {
      const x = points.length === 1 ? paddingX + usableWidth / 2 : paddingX + (i / (points.length - 1)) * usableWidth;
      const y = paddingY + (1 - p.value / max) * usableHeight;
      return { x, y, raw: p };
    });

    if (coords.length === 1) {
      const c = coords[0];
      return {
        maxValue: max,
        svgPoints: coords,
        areaPath: `M ${paddingX},${chartHeight} L ${c.x},${c.y} L ${chartWidth - paddingX},${chartHeight} Z`,
        linePath: `M ${paddingX},${c.y} L ${chartWidth - paddingX},${c.y}`,
      };
    }

    let line = `M ${coords[0].x},${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      // Smooth bezier curves
      const prev = coords[i - 1];
      const curr = coords[i];
      const cpX1 = prev.x + (curr.x - prev.x) / 2;
      const cpX2 = cpX1;
      line += ` C ${cpX1},${prev.y} ${cpX2},${curr.y} ${curr.x},${curr.y}`;
    }

    const first = coords[0];
    const last = coords[coords.length - 1];
    const area = `${line} L ${last.x},${chartHeight - 8} L ${first.x},${chartHeight - 8} Z`;

    return {
      maxValue: max,
      svgPoints: coords,
      areaPath: area,
      linePath: line,
    };
  }, [points, height]);

  const activePoint = hoverIndex !== null && svgPoints[hoverIndex] ? svgPoints[hoverIndex] : null;

  return (
    <div className={clsx("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-sunken p-0.5">
          <button
            onClick={() => setMetric("revenue")}
            className={clsx(
              "rounded-md px-2.5 py-1 text-[12px] font-semibold transition-all",
              metric === "revenue" ? "bg-white text-primary-600 shadow-xs" : "text-ink-muted hover:text-ink",
            )}
          >
            Total Revenue
          </button>
          <button
            onClick={() => setMetric("paid")}
            className={clsx(
              "rounded-md px-2.5 py-1 text-[12px] font-semibold transition-all",
              metric === "paid" ? "bg-white text-emerald-600 shadow-xs" : "text-ink-muted hover:text-ink",
            )}
          >
            Collections (Paid)
          </button>
          <button
            onClick={() => setMetric("orders_count")}
            className={clsx(
              "rounded-md px-2.5 py-1 text-[12px] font-semibold transition-all",
              metric === "orders_count" ? "bg-white text-blue-600 shadow-xs" : "text-ink-muted hover:text-ink",
            )}
          >
            Orders Count
          </button>
        </div>

        {activePoint && (
          <div className="flex items-center gap-2 rounded-md bg-ink px-2.5 py-1 text-xs text-white shadow-md">
            <span className="font-medium text-white/70">{activePoint.raw.label}:</span>
            <span className="font-bold">
              {metric === "orders_count" ? `${activePoint.raw.value} orders` : formatCurrency(activePoint.raw.value, currencyCode)}
            </span>
          </div>
        )}
      </div>

      <div className="relative w-full overflow-hidden" style={{ height }}>
        {points.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-faint">No trend data available for this range</div>
        ) : (
          <svg
            viewBox={`0 0 700 ${height}`}
            className="h-full w-full overflow-visible"
            preserveAspectRatio="none"
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c31432" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#c31432" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map((p) => {
              const y = 24 + (1 - p) * (height - 48);
              return (
                <line
                  key={p}
                  x1="20"
                  y1={y}
                  x2="680"
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              );
            })}

            {/* Area gradient fill */}
            <path
              d={areaPath}
              fill={metric === "paid" ? "url(#emeraldGrad)" : metric === "orders_count" ? "url(#blueGrad)" : "url(#primaryGrad)"}
            />

            {/* Stroke line */}
            <path
              d={linePath}
              fill="none"
              stroke={metric === "paid" ? "#10b981" : metric === "orders_count" ? "#3b82f6" : "#c31432"}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Hover Points and Trigger Columns */}
            {svgPoints.map((pt, i) => {
              const isHovered = hoverIndex === i;
              const colWidth = 700 / svgPoints.length;
              const strokeCol = metric === "paid" ? "#10b981" : metric === "orders_count" ? "#3b82f6" : "#c31432";

              return (
                <g key={i}>
                  {/* Invisible touch column for smooth mouse tracking */}
                  <rect
                    x={pt.x - colWidth / 2}
                    y={0}
                    width={colWidth}
                    height={height}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoverIndex(i)}
                  />

                  {/* Active highlight line */}
                  {isHovered && (
                    <line
                      x1={pt.x}
                      y1={16}
                      x2={pt.x}
                      y2={height - 16}
                      stroke={strokeCol}
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  )}

                  {/* Dot */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 6 : svgPoints.length <= 15 ? 3.5 : 0}
                    fill="#ffffff"
                    stroke={strokeCol}
                    strokeWidth={isHovered ? 3 : 2}
                    className="transition-all duration-150"
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Date ticks preview */}
      {svgPoints.length > 0 && (
        <div className="flex items-center justify-between px-3 text-[11px] font-medium text-ink-muted">
          <span>{svgPoints[0]?.raw.label}</span>
          {svgPoints.length > 2 && <span>{svgPoints[Math.floor(svgPoints.length / 2)]?.raw.label}</span>}
          <span>{svgPoints[svgPoints.length - 1]?.raw.label}</span>
        </div>
      )}
    </div>
  );
}
