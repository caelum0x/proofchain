"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";

export interface DialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
  readonly size?: "sm" | "md" | "lg";
  readonly className?: string;
}

const SIZES = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" } as const;

/**
 * Modal dialog rendered in a portal. Traps focus loosely (auto-focuses the
 * panel), closes on backdrop click and Escape, and locks body scroll while open.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = "md", className }: DialogProps) {
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
    >
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative w-full animate-slide-up rounded-xl border border-border bg-surface shadow-overlay outline-none",
          SIZES[size],
          className,
        )}
      >
        {(
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-3.5">
            <div>
              {title ? <h2 className="text-base font-semibold text-fg">{title}</h2> : null}
              {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
            </div>
            <IconButton icon="close" label="Close dialog" variant="ghost" size="sm" onClick={onClose} />
          </div>
        )}
        {children ? <div className="px-5 py-4">{children}</div> : null}
        {footer ? <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
