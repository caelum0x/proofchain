import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { LoadingState, EmptyState, ErrorState } from "./States";
import { Icon } from "./Icon";

export interface Column<T> {
  /** Stable column id (also used as React key). */
  readonly id: string;
  readonly header: ReactNode;
  /** Cell renderer for a row. */
  readonly cell: (row: T, index: number) => ReactNode;
  readonly align?: "left" | "right" | "center";
  /** Extra classes for the cell + header (e.g. width, hidden on mobile). */
  readonly className?: string;
  /** Enable the sort control on this column's header. */
  readonly sortable?: boolean;
}

/** Controlled sort state: which column and direction. */
export interface SortState {
  readonly id: string;
  readonly dir: "asc" | "desc";
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
  /** Controlled sort (URL is the source of truth). */
  readonly sort?: SortState | null;
  readonly onSortChange?: (sort: SortState) => void;
  /** Sticky header inside a scrollable region. */
  readonly stickyHeader?: boolean;
  /** Row selection (checkbox column). */
  readonly selectable?: boolean;
  readonly selectedKeys?: ReadonlySet<string>;
  readonly onSelectionChange?: (keys: ReadonlySet<string>) => void;
  /** Max height for the scroll region when using a sticky header. */
  readonly maxHeight?: string;
}

const ALIGN: Record<NonNullable<Column<unknown>["align"]>, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

/**
 * Generic, typed table with built-in loading / error / empty states, optional
 * controlled sorting, sticky header, and row selection. Column definitions
 * carry their own cell renderers so pages describe data once and get consistent
 * styling, keyboard-accessible row clicks, and graceful fallbacks for free.
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
  sort = null,
  onSortChange,
  stickyHeader = false,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  maxHeight,
}: DataTableProps<T>) {
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const clickable = Boolean(onRowClick);
  const selected = selectedKeys ?? new Set<string>();
  const allKeys = rows.map((row, i) => getRowKey(row, i));
  const allSelected = selectable && allKeys.length > 0 && allKeys.every((k) => selected.has(k));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? new Set() : new Set(allKeys));
  };
  const toggleRow = (key: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  };

  const requestSort = (id: string) => {
    if (!onSortChange) return;
    const dir = sort?.id === id && sort.dir === "asc" ? "desc" : "asc";
    onSortChange({ id, dir });
  };

  return (
    <div
      className={cn("overflow-auto rounded-xl border border-border", className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full border-collapse text-sm">
        <thead className={cn(stickyHeader && "sticky top-0 z-10")}>
          <tr className="border-b border-border bg-surface-2/80 backdrop-blur">
            {selectable ? (
              <th scope="col" className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-border bg-surface-2 accent-brand"
                />
              </th>
            ) : null}
            {columns.map((col) => {
              const active = sort?.id === col.id;
              return (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  className={cn(
                    "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted",
                    ALIGN[col.align ?? "left"],
                    col.className,
                  )}
                >
                  {col.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => requestSort(col.id)}
                      className={cn(
                        "inline-flex items-center gap-1 transition-colors hover:text-fg",
                        active && "text-fg",
                      )}
                    >
                      {col.header}
                      <Icon
                        name={active ? (sort.dir === "asc" ? "arrow-left" : "arrow-right") : "sort"}
                        size={13}
                        className={cn(active ? "text-brand" : "text-faint", active && "-rotate-90")}
                      />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const key = getRowKey(row, index);
            const isSel = selected.has(key);
            return (
              <tr
                key={key}
                className={cn(
                  "border-b border-border/60 last:border-0",
                  isSel && "bg-brand/5",
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
                {selectable ? (
                  <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label="Select row"
                      checked={isSel}
                      onChange={() => toggleRow(key)}
                      className="h-4 w-4 rounded border-border bg-surface-2 accent-brand"
                    />
                  </td>
                ) : null}
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={cn("px-4 py-3 text-fg/90", ALIGN[col.align ?? "left"], col.className)}
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
