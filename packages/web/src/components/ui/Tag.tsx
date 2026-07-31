import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export interface TagProps {
  readonly children: ReactNode;
  /** Show a removable "×" affordance. */
  readonly onRemove?: () => void;
  readonly className?: string;
}

/** A small, neutral label chip — optionally removable (filter tokens, facets). */
export function Tag({ children, onRemove, className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs text-fg",
        className,
      )}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="ml-0.5 rounded text-muted transition-colors hover:text-fg"
        >
          <Icon name="close" size={12} />
        </button>
      ) : null}
    </span>
  );
}
