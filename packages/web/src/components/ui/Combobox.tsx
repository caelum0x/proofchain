"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export interface ComboboxOption {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
}

export interface ComboboxProps {
  readonly options: readonly ComboboxOption[];
  readonly value: string | null;
  readonly onValueChange: (value: string | null) => void;
  readonly placeholder?: string;
  readonly emptyMessage?: string;
  readonly id?: string;
  readonly className?: string;
}

/**
 * Searchable single-select combobox (dependency-free). Filters options by the
 * typed query and supports keyboard + mouse selection.
 */
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Search…",
  emptyMessage = "No matches",
  id,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const commit = (opt: ComboboxOption) => {
    onValueChange(opt.value);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open && filtered[active]) {
      e.preventDefault();
      commit(filtered[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={id ? `${id}-list` : undefined}
          className="input pr-9"
          placeholder={placeholder}
          value={open ? query : (selected?.label ?? "")}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <Icon name="search" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
      </div>
      {open ? (
        <ul
          id={id ? `${id}-list` : undefined}
          role="listbox"
          className="absolute z-40 mt-1.5 max-h-64 w-full animate-slide-up overflow-auto rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">{emptyMessage}</li>
          ) : (
            filtered.map((opt, index) => (
              <li key={opt.value} role="option" aria-selected={opt.value === value}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => commit(opt)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm",
                    index === active ? "bg-surface-2 text-fg" : "text-fg/90",
                  )}
                >
                  <span>{opt.label}</span>
                  {opt.hint ? <span className="font-mono text-xs text-faint">{opt.hint}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
