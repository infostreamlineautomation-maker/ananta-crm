"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/Field";

export interface DatePresetOption {
  key: string;
  label: string;
  getFromTo: () => { from: string; to: string };
}

export function getDatePresets(): DatePresetOption[] {
  const today = new Date();
  const formatIso = (d: Date) => d.toISOString().slice(0, 10);

  return [
    {
      key: "today",
      label: "Today",
      getFromTo: () => {
        const d = formatIso(today);
        return { from: d, to: d };
      },
    },
    {
      key: "7d",
      label: "7 Days",
      getFromTo: () => {
        const from = new Date(today);
        from.setDate(today.getDate() - 6);
        return { from: formatIso(from), to: formatIso(today) };
      },
    },
    {
      key: "this_month",
      label: "This Month",
      getFromTo: () => {
        const from = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: formatIso(from), to: formatIso(today) };
      },
    },
    {
      key: "last_month",
      label: "Last Month",
      getFromTo: () => {
        const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const to = new Date(today.getFullYear(), today.getMonth(), 0);
        return { from: formatIso(from), to: formatIso(to) };
      },
    },
    {
      key: "this_quarter",
      label: "This Quarter",
      getFromTo: () => {
        const qMonth = Math.floor(today.getMonth() / 3) * 3;
        const from = new Date(today.getFullYear(), qMonth, 1);
        return { from: formatIso(from), to: formatIso(today) };
      },
    },
    {
      key: "this_year",
      label: "This Year",
      getFromTo: () => {
        const from = new Date(today.getFullYear(), 0, 1);
        return { from: formatIso(from), to: formatIso(today) };
      },
    },
  ];
}

interface DatePresetsProps {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
  className?: string;
}

export function DatePresets({ dateFrom, dateTo, onChange, className }: DatePresetsProps) {
  const presets = useMemo(() => getDatePresets(), []);

  const activePreset = useMemo(() => {
    const match = presets.find((p) => {
      const { from, to } = p.getFromTo();
      return from === dateFrom && to === dateTo;
    });
    return match ? match.key : "custom";
  }, [dateFrom, dateTo, presets]);

  function selectPreset(p: DatePresetOption) {
    const { from, to } = p.getFromTo();
    onChange(from, to);
  }

  return (
    <div className={clsx("flex flex-wrap items-center gap-2", className)}>
      <div className="flex items-center rounded-lg border border-border bg-surface-sunken p-0.5">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => selectPreset(p)}
            className={clsx(
              "rounded-md px-2.5 py-1 text-[12.5px] font-semibold transition-all",
              activePreset === p.key
                ? "bg-white text-primary-600 shadow-sm"
                : "text-ink-muted hover:text-ink hover:bg-white/50",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-2 py-1 shadow-xs">
        <Calendar className="h-3.5 w-3.5 text-ink-faint flex-none" />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onChange(e.target.value, dateTo)}
          className="w-[110px] bg-transparent text-[12px] font-medium text-ink focus:outline-hidden"
        />
        <span className="text-[12px] text-ink-faint">–</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onChange(dateFrom, e.target.value)}
          className="w-[110px] bg-transparent text-[12px] font-medium text-ink focus:outline-hidden"
        />
      </div>
    </div>
  );
}
