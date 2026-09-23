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
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) || null;

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q)
    );
  }, [options, query]);

  // Total selectable items = filtered options + 1 (if onAddNew is present)
  const totalItems = filtered.length + (onAddNew ? 1 : 0);

  // Auto reset highlighted index when query or open state changes
  useEffect(() => {
    if (open) {
      if (selected) {
        const selectedIdx = filtered.findIndex((o) => o.value === selected.value);
        setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
      } else {
        setHighlightedIndex(0);
      }
    }
  }, [open, filtered, selected]);

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
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>("[data-combobox-item]");
    const activeItem = items[highlightedIndex];
    if (activeItem) {
      activeItem.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [highlightedIndex, open]);

  function selectOption(val: number | string) {
    onChange(val);
    setOpen(false);
    setQuery("");
    buttonRef.current?.focus();
  }

  function handleAddNewAction() {
    setOpen(false);
    setQuery("");
    if (onAddNew) onAddNew();
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (totalItems > 0) {
        setHighlightedIndex((prev) => (prev + 1) % totalItems);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (totalItems > 0) {
        setHighlightedIndex((prev) => (prev - 1 + totalItems) % totalItems);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        selectOption(filtered[highlightedIndex].value);
      } else if (highlightedIndex === filtered.length && onAddNew) {
        handleAddNewAction();
      } else if (filtered.length === 1) {
        selectOption(filtered[0].value);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      buttonRef.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
      setQuery("");
    }
  }

  function handleButtonKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleButtonKeyDown}
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
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Type to search..."
            className="w-full border-b border-border px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none bg-surface"
          />
          <div ref={listRef} className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-[13px] text-ink-faint">No matches found.</p>
            )}
            {filtered.map((o, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const isSelected = o.value === value;
              return (
                <button
                  key={o.value}
                  data-combobox-item
                  type="button"
                  onClick={() => selectOption(o.value)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={clsx(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13.5px] transition-colors",
                    isHighlighted ? "bg-primary-50 text-primary-900 font-medium" : "text-ink hover:bg-surface-sunken"
                  )}
                >
                  <span className="min-w-0 truncate">
                    {o.label}
                    {o.sublabel && <span className="ml-1.5 text-xs text-ink-faint">({o.sublabel})</span>}
                  </span>
                  {isSelected && <Check className="h-3.5 w-3.5 flex-none text-primary-600" />}
                </button>
              );
            })}
          </div>
          {onAddNew && (
            <button
              data-combobox-item
              type="button"
              onClick={handleAddNewAction}
              onMouseEnter={() => setHighlightedIndex(filtered.length)}
              className={clsx(
                "flex w-full items-center gap-1.5 border-t border-border px-3 py-2.5 text-[13px] font-semibold text-primary-600 transition-colors",
                highlightedIndex === filtered.length ? "bg-primary-100/70 text-primary-950" : "hover:bg-primary-50"
              )}
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
