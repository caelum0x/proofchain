import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface DetailShellProps {
  /** Primary column (main content). */
  readonly children: ReactNode;
  /** Sticky right rail: metadata, actions, timeline. */
  readonly rail: ReactNode;
  /** Optional header rendered above both columns (e.g. PageHeader). */
  readonly header?: ReactNode;
  readonly railWidth?: string;
  readonly className?: string;
}

/**
 * Two-column detail layout (WD §2): scrollable main content beside a sticky
 * right rail for metadata, actions, and timelines. Reflows to a single column
 * on small screens (rail moves below the content).
 */
export function DetailShell({ children, rail, header, railWidth = "20rem", className }: DetailShellProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {header}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-6">{children}</div>
        <aside className="w-full shrink-0 lg:sticky lg:top-20" style={{ maxWidth: "100%", flexBasis: railWidth }}>
          <div className="space-y-4 lg:w-full" style={{ width: "100%" }}>
            {rail}
          </div>
        </aside>
      </div>
    </div>
  );
}
