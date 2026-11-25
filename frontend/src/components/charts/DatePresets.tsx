"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

export interface DatePresetOption {
  key: string;
  label: string;
  getFromTo: () => { from: string; to: string };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseIsoParts(iso: string): { y: number; m: number; d: number } | null {
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  return { y, m, d };
}

function formatReadableDate(iso: string): string {
  const p = parseIsoParts(iso);
  if (!p) return iso || "—";
  return `${pad2(p.d)} ${SHORT_MONTHS[p.m] || ""} ${p.y}`;
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

export function DatePresetPills({ dateFrom, dateTo, onChange, className }: DatePresetsProps) {
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
    <div className={clsx("inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-surface-sunken p-0.5", className)}>
      {presets.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => selectPreset(p)}
          className={clsx(
            "rounded-md px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer",
            activePreset === p.key
              ? "bg-white text-primary-600 shadow-sm font-bold"
              : "text-ink-muted hover:text-ink hover:bg-white/60",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function DateRangePicker({ dateFrom, dateTo, onChange, className }: DatePresetsProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pickingEnd, setPickingEnd] = useState(false);
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const initialParts = parseIsoParts(dateTo || dateFrom);
  const today = new Date();
  const todayIso = toLocalIso(today);

  const [viewYear, setViewYear] = useState<number>(initialParts?.y ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialParts?.m ?? today.getMonth());

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      const target = parseIsoParts(dateTo || dateFrom);
      if (target) {
        setViewYear(target.y);
        setViewMonth(target.m);
      }
      setPickingEnd(false);
      setHoverIso(null);
    }
  }, [open, dateFrom, dateTo]);

  const updatePos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 312;
    let left = rect.right - width;
    if (left < 12) left = 12;
    if (left + width > window.innerWidth - 12) {
      left = window.innerWidth - width - 12;
    }
    let top = rect.bottom + 6;
    const estHeight = 365;
    if (top + estHeight > window.innerHeight && rect.top > estHeight) {
      top = Math.max(12, rect.top - estHeight - 6);
    }
    setPos({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    updatePos();
    function handleOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(t) &&
        popoverRef.current &&
        !popoverRef.current.contains(t)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open]);

  const calendarCells = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { iso: string; day: number; inMonth: boolean }[] = [];

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const dt = new Date(viewYear, viewMonth - 1, d);
      cells.push({ iso: toLocalIso(dt), day: d, inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(viewYear, viewMonth, d);
      cells.push({ iso: toLocalIso(dt), day: d, inMonth: true });
    }
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(viewYear, viewMonth + 1, d);
      cells.push({ iso: toLocalIso(dt), day: d, inMonth: false });
    }
    return cells;
  }, [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handleDayClick(iso: string) {
    if (!pickingEnd) {
      onChange(iso, iso);
      setPickingEnd(true);
    } else {
      if (iso < dateFrom) {
        onChange(iso, dateFrom);
      } else {
        onChange(dateFrom, iso);
      }
      setPickingEnd(false);
      setOpen(false);
    }
  }

  const effectiveStart = pickingEnd && hoverIso && hoverIso < dateFrom ? hoverIso : dateFrom;
  const effectiveEnd = pickingEnd && hoverIso ? (hoverIso < dateFrom ? dateFrom : hoverIso) : dateTo;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={clsx(
          "inline-flex h-9 items-center gap-2 rounded-lg border bg-white px-3 text-xs font-semibold text-ink shadow-2xs transition-all cursor-pointer shrink-0",
          open ? "border-primary-400 ring-2 ring-primary-500/15" : "border-border hover:border-primary-300",
          className
        )}
        title="Pick custom date range"
      >
        <Calendar className="h-3.5 w-3.5 text-primary-600 shrink-0" />
        <span className="font-mono whitespace-nowrap">{formatReadableDate(dateFrom)}</span>
        <span className="text-ink-faint">→</span>
        <span className="font-mono whitespace-nowrap">{formatReadableDate(dateTo)}</span>
        <ChevronDown className={clsx("h-3.5 w-3.5 text-ink-muted transition-transform duration-150", open && "rotate-180 text-primary-600")} />
      </button>

      {open &&
        mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
            className="fixed z-[9999] w-[312px] rounded-xl border border-border bg-white p-3.5 shadow-[var(--shadow-pop)] ring-1 ring-black/5 animate-report-fade-up"
          >
            {/* Active selection hint bar */}
            <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-lg bg-surface-sunken/70 p-1 text-[11px]">
              <button
                type="button"
                onClick={() => setPickingEnd(false)}
                className={clsx(
                  "rounded-md px-2 py-1 text-left transition-all cursor-pointer",
                  !pickingEnd ? "bg-white shadow-2xs border border-primary-200 text-primary-700" : "text-ink-muted hover:text-ink"
                )}
              >
                <div className="text-[9.5px] uppercase font-bold tracking-wider opacity-70">From</div>
                <div className="font-mono font-bold truncate">{formatReadableDate(dateFrom)}</div>
              </button>
              <button
                type="button"
                onClick={() => setPickingEnd(true)}
                className={clsx(
                  "rounded-md px-2 py-1 text-left transition-all cursor-pointer",
                  pickingEnd ? "bg-white shadow-2xs border border-primary-200 text-primary-700" : "text-ink-muted hover:text-ink"
                )}
              >
                <div className="text-[9.5px] uppercase font-bold tracking-wider opacity-70">To</div>
                <div className="font-mono font-bold truncate">{formatReadableDate(dateTo)}</div>
              </button>
            </div>

            {/* Month Header */}
            <div className="mb-2.5 flex items-center justify-between px-1">
              <button
                type="button"
                onClick={prevMonth}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 bg-surface hover:bg-surface-hover text-ink-muted hover:text-ink transition-colors cursor-pointer"
                title="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-xs font-extrabold tracking-wide text-ink">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </div>
              <button
                type="button"
                onClick={nextMonth}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 bg-surface hover:bg-surface-hover text-ink-muted hover:text-ink transition-colors cursor-pointer"
                title="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday labels */}
            <div className="mb-1 grid grid-cols-7 text-center">
              {WEEKDAYS.map((wd) => (
                <div key={wd} className="py-1 text-[10.5px] font-bold uppercase text-ink-faint">
                  {wd}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-y-0.5" onMouseLeave={() => setHoverIso(null)}>
              {calendarCells.map((cell) => {
                const isStart = cell.iso === effectiveStart;
                const isEnd = cell.iso === effectiveEnd;
                const isEndpoint = isStart || isEnd;
                const isInRange = cell.iso > effectiveStart && cell.iso < effectiveEnd;
                const isToday = cell.iso === todayIso;

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onMouseEnter={() => pickingEnd && setHoverIso(cell.iso)}
                    onClick={() => handleDayClick(cell.iso)}
                    className={clsx(
                      "relative flex h-8 w-full items-center justify-center text-xs font-mono transition-colors cursor-pointer",
                      isEndpoint
                        ? "bg-primary-600 text-white font-bold rounded-lg shadow-xs z-10"
                        : isInRange
                        ? "bg-primary-50 text-primary-700 font-semibold"
                        : cell.inMonth
                        ? "text-ink hover:bg-surface-hover rounded-lg"
                        : "text-ink-faint/45 hover:bg-surface-hover/50 rounded-lg",
                      isToday && !isEndpoint && "ring-1 ring-inset ring-primary-300 font-bold"
                    )}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {/* Footer actions */}
            <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2.5 text-[11px]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onChange(todayIso, todayIso);
                    setOpen(false);
                  }}
                  className="font-semibold text-primary-600 hover:text-primary-700 hover:underline cursor-pointer"
                >
                  Today
                </button>
                <span className="text-border">•</span>
                <button
                  type="button"
                  onClick={() => {
                    const monthStart = toLocalIso(new Date(today.getFullYear(), today.getMonth(), 1));
                    onChange(monthStart, todayIso);
                    setOpen(false);
                  }}
                  className="font-semibold text-ink-muted hover:text-ink hover:underline cursor-pointer"
                >
                  This Month
                </button>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md bg-surface-sunken hover:bg-surface-hover border border-border px-2.5 py-1 font-bold text-ink transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export function DatePresets({ dateFrom, dateTo, onChange, className }: DatePresetsProps) {
  return (
    <div className={clsx("flex flex-wrap items-center gap-2", className)}>
      <DatePresetPills dateFrom={dateFrom} dateTo={dateTo} onChange={onChange} />
      <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={onChange} />
    </div>
  );
}
