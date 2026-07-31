"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SwitchProps {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly label?: ReactNode;
  readonly description?: ReactNode;
  readonly disabled?: boolean;
  readonly id?: string;
  readonly className?: string;
}

/** Accessible on/off toggle (role="switch"). */
export function Switch({ checked, onCheckedChange, label, description, disabled, id, className }: SwitchProps) {
  const control = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-pill border transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-brand bg-brand" : "border-border bg-surface-2",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
  if (!label) return control;
  return (
    <label htmlFor={id} className="flex items-start justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-sm text-fg">{label}</span>
        {description ? <span className="block text-xs text-muted">{description}</span> : null}
      </span>
      {control}
    </label>
  );
}
