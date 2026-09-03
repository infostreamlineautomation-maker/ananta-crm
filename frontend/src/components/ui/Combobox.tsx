"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import clsx from "clsx";

export interface ComboboxOption {
  value: number | string;
  label: string;
  sublabel?: string;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select...",
  onAddNew,
  addNewLabel = "Add new",
  disabled,
}: {
  value: number | string | null;
  onChange: (value: number | string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  onAddNew?: () => void;
  addNewLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) || null;

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex h-10 w-full items-center gap-2 rounded-md border border-border bg-white px-3 text-left text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-surface-sunken disabled:text-ink-faint",
          !selected && "text-ink-faint",
        )}
      >
        <Search className="h-4 w-4 flex-none text-ink-faint" />
        <span className="min-w-0 flex-1 truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="h-4 w-4 flex-none text-ink-faint" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 rounded-md border border-border bg-surface shadow-[var(--shadow-pop)]">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search..."
            className="w-full border-b border-border px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && <p className="px-3 py-4 text-center text-[13px] text-ink-faint">No matches.</p>}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13.5px] text-ink hover:bg-surface-sunken"
              >
                <span className="min-w-0 truncate">
                  {o.label}
                  {o.sublabel && <span className="ml-1.5 text-ink-faint">{o.sublabel}</span>}
                </span>
                {o.value === value && <Check className="h-3.5 w-3.5 flex-none text-primary-500" />}
              </button>
            ))}
          </div>
          {onAddNew && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setQuery("");
                onAddNew();
              }}
              className="flex w-full items-center gap-1.5 border-t border-border px-3 py-2.5 text-[13px] font-semibold text-primary-500 hover:bg-primary-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {addNewLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
