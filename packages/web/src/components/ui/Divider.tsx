import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface DividerProps {
  readonly orientation?: "horizontal" | "vertical";
  /** Optional centered label (horizontal only). */
  readonly label?: ReactNode;
  readonly className?: string;
}

/** A hairline separator, optionally with a centered label. */
export function Divider({ orientation = "horizontal", label, className }: DividerProps) {
  if (orientation === "vertical") {
    return <span role="separator" aria-orientation="vertical" className={cn("mx-2 inline-block h-full w-px self-stretch bg-border", className)} />;
  }
  if (label) {
    return (
      <div className={cn("flex items-center gap-3", className)} role="separator">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase tracking-wide text-faint">{label}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    );
  }
  return <hr className={cn("border-0 border-t border-border", className)} />;
}
