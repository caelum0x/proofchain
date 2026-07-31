"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";

export interface ToolbarProps {
  /** Left cluster — usually search + filters. */
  readonly children?: ReactNode;
  /** Right cluster — sort, view toggle, export, primary action. */
  readonly actions?: ReactNode;
  readonly className?: string;
}

/**
 * The list toolbar (WD §3.3): a responsive row hosting the FilterBar / search
 * on the left and sort / view toggle / export on the right.
 */
export function Toolbar({ children, actions, className }: ToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export interface FilterBarProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/** A horizontally scrollable row of filter facets/chips. */
export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} role="group" aria-label="Filters">
      {children}
    </div>
  );
}

export type ViewMode = "table" | "grid";

export interface ViewToggleProps {
  readonly value: ViewMode;
  readonly onChange: (mode: ViewMode) => void;
  readonly className?: string;
}

/** Table/grid view switch for list bodies (WD §3.3). */
export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  return (
    <div className={cn("inline-flex overflow-hidden rounded-lg border border-border", className)} role="group" aria-label="View mode">
      {(["table", "grid"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={value === mode}
          aria-label={`${mode} view`}
          onClick={() => onChange(mode)}
          className={cn(
            "grid h-9 w-9 place-items-center transition-colors",
            value === mode ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
          )}
        >
          <Icon name={mode === "table" ? "list" : "grid"} size={16} />
        </button>
      ))}
    </div>
  );
}
