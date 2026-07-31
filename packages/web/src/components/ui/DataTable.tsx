import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { LoadingState, EmptyState, ErrorState } from "./States";

export interface Column<T> {
  /** Stable column id (also used as React key). */
  readonly id: string;
  readonly header: ReactNode;
  /** Cell renderer for a row. */
  readonly cell: (row: T, index: number) => ReactNode;
  readonly align?: "left" | "right" | "center";
  /** Extra classes for the cell + header (e.g. width, hidden on mobile). */
  readonly className?: string;
}

interface DataTableProps<T> {
  readonly columns: readonly Column<T>[];
  readonly rows: readonly T[];
  /** Stable key per row. */
  readonly getRowKey: (row: T, index: number) => string;
  readonly onRowClick?: (row: T) => void;
  readonly isLoading?: boolean;
  readonly error?: string | null;
  readonly onRetry?: () => void;
  /** Copy shown when there are no rows and no error. */
  readonly emptyTitle?: string;
  readonly emptyDescription?: ReactNode;
  readonly className?: string;
}

const ALIGN: Record<NonNullable<Column<unknown>["align"]>, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

/**
 * Generic, typed table with built-in loading / error / empty states. Column
 * definitions carry their own cell renderers so page agents describe data once
 * and get consistent styling, keyboard-accessible row clicks, and graceful
 * fallbacks for free.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  isLoading = false,
  error = null,
  onRetry,
  emptyTitle = "Nothing to show yet",
  emptyDescription,
  className,
}: DataTableProps<T>) {
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const clickable = Boolean(onRowClick);

  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/50">
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className={cn(
                  "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted",
                  ALIGN[col.align ?? "left"],
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const key = getRowKey(row, index);
            return (
              <tr
                key={key}
                className={cn(
                  "border-b border-border/60 last:border-0",
                  clickable && "cursor-pointer transition-colors hover:bg-surface-2/40",
                )}
                onClick={clickable ? () => onRowClick?.(row) : undefined}
                onKeyDown={
                  clickable
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick?.(row);
                        }
                      }
                    : undefined
                }
                tabIndex={clickable ? 0 : undefined}
                role={clickable ? "button" : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={cn(
                      "px-4 py-3 text-fg/90",
                      ALIGN[col.align ?? "left"],
                      col.className,
                    )}
                  >
                    {col.cell(row, index)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
