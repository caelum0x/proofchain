"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { ALL_SIDEBAR_ITEMS } from "@/lib/sidebar-nav";

/**
 * Global route search (WD §2 TopBar). Filters every navigable route and jumps
 * to it. Opens with Cmd/Ctrl+K; keyboard navigable.
 */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_SIDEBAR_ITEMS.slice(0, 8);
    return ALL_SIDEBAR_ITEMS.filter(
      (i) => i.label.toLowerCase().includes(q) || i.href.toLowerCase().includes(q),
    ).slice(0, 10);
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const go = (href: string) => {
    router.push(href);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  return (
    <div ref={rootRef} className={cn("relative w-full max-w-md", className)}>
      <div className="relative">
        <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-label="Search routes"
          className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-9 pr-14 text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
          placeholder="Search…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              go(results[active].href);
            }
          }}
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-faint sm:block">
          ⌘K
        </kbd>
      </div>
      {open && results.length > 0 ? (
        <ul role="listbox" className="absolute z-40 mt-1.5 w-full animate-slide-up overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-lg">
          {results.map((item, index) => (
            <li key={item.href} role="option" aria-selected={index === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => go(item.href)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm",
                  index === active ? "bg-surface-2 text-fg" : "text-fg/90",
                )}
              >
                <Icon name={item.icon} size={15} className="text-muted" />
                <span className="flex-1">{item.label}</span>
                <span className="font-mono text-xs text-faint">{item.href}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
