"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface RadioOption {
  readonly value: string;
  readonly label: ReactNode;
  readonly description?: ReactNode;
  readonly disabled?: boolean;
}

export interface RadioGroupProps {
  readonly options: readonly RadioOption[];
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly name?: string;
  readonly className?: string;
}

/** Accessible radio group rendered as selectable cards. */
export function RadioGroup({ options, value, onValueChange, name, className }: RadioGroupProps) {
  const auto = useId();
  const groupName = name ?? auto;
  return (
    <div role="radiogroup" className={cn("grid gap-2", className)}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors",
              selected ? "border-brand bg-brand/10" : "border-border hover:bg-surface-2/50",
              opt.disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <input
              type="radio"
              name={groupName}
              value={opt.value}
              checked={selected}
              disabled={opt.disabled}
              onChange={() => onValueChange(opt.value)}
              className="mt-0.5 h-4 w-4 accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            />
            <span className="min-w-0">
              <span className="block text-sm text-fg">{opt.label}</span>
              {opt.description ? <span className="block text-xs text-muted">{opt.description}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
