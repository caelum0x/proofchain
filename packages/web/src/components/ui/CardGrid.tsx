import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { LoadingState, EmptyState, ErrorState } from "./States";

interface CardGridProps<T> {
  readonly items: readonly T[];
  readonly renderItem: (item: T, index: number) => ReactNode;
  readonly getKey: (item: T, index: number) => string;
  /** Minimum column width; the grid auto-fills responsively. */
  readonly minColWidth?: number;
  readonly isLoading?: boolean;
  readonly error?: string | null;
  readonly onRetry?: () => void;
  readonly emptyTitle?: string;
  readonly emptyDescription?: ReactNode;
  readonly skeleton?: ReactNode;
  readonly skeletonCount?: number;
  readonly className?: string;
}

/**
 * Responsive gallery grid with built-in loading/empty/error states — the
 * `CardGrid` body option from WD §3. Columns auto-fill from `minColWidth`.
 */
export function CardGrid<T>({
  items,
  renderItem,
  getKey,
  minColWidth = 260,
  isLoading = false,
  error = null,
  onRetry,
  emptyTitle = "Nothing to show yet",
  emptyDescription,
  skeleton,
  skeletonCount = 6,
  className,
}: CardGridProps<T>) {
  const style = { gridTemplateColumns: `repeat(auto-fill, minmax(${minColWidth}px, 1fr))` };

  if (isLoading) {
    if (skeleton) {
      return (
        <div className={cn("grid gap-4", className)} style={style}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i}>{skeleton}</div>
          ))}
        </div>
      );
    }
    return <LoadingState />;
  }
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (items.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div className={cn("grid gap-4", className)} style={style}>
      {items.map((item, index) => (
        <div key={getKey(item, index)}>{renderItem(item, index)}</div>
      ))}
    </div>
  );
}
