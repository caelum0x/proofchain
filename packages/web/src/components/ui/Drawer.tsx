"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";

export interface DrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title?: ReactNode;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
  readonly side?: "right" | "left";
  readonly width?: string;
  readonly className?: string;
}

/**
 * Slide-in panel anchored to a screen edge. Used for detail views, mobile nav,
 * and contextual editors. Closes on backdrop click / Escape; locks body scroll.
 */
export function Drawer({ open, onClose, title, children, footer, side = "right", width = "26rem", className }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Panel"}>
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{ width }}
        className={cn(
          "absolute top-0 flex h-full max-w-[92vw] flex-col border-border bg-surface shadow-overlay outline-none animate-slide-in-right",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
          {title ? <h2 className="text-base font-semibold text-fg">{title}</h2> : <span />}
          <IconButton icon="close" label="Close panel" variant="ghost" size="sm" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-border px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
