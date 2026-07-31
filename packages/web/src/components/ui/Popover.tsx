"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface PopoverProps {
  /** Trigger element; receives no props (wrap your own button). */
  readonly trigger: ReactNode;
  readonly children: ReactNode;
  readonly align?: "start" | "end";
  readonly className?: string;
  readonly contentClassName?: string;
}

/**
 * Click-triggered floating panel that closes on outside click / Escape. Use for
 * filter panels, pickers, and secondary actions. `Dropdown` builds on this for
 * menu semantics.
 */
export function Popover({ trigger, children, align = "start", className, contentClassName }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="dialog" aria-expanded={open}>
        {trigger}
      </button>
      {open ? (
        <div
          className={cn(
            "absolute top-full z-40 mt-1.5 min-w-[12rem] animate-slide-up rounded-lg border border-border bg-surface p-2 shadow-lg",
            align === "end" ? "right-0" : "left-0",
            contentClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
