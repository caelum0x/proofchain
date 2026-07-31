import type { ReactNode } from "react";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/States";

export interface AsyncBoundaryProps {
  readonly isLoading?: boolean;
  readonly error?: string | null;
  readonly onRetry?: () => void;
  /** When true (and not loading/error), render the empty state. */
  readonly isEmpty?: boolean;
  readonly loading?: ReactNode;
  readonly emptyTitle?: string;
  readonly emptyDescription?: ReactNode;
  readonly emptyAction?: ReactNode;
  readonly children: ReactNode;
}

/**
 * The state-layer wrapper (WD §3.5): every body wraps loading / error / empty
 * so a page never renders a blank screen. Pass a custom `loading` skeleton for
 * a layout-stable placeholder.
 */
export function AsyncBoundary({
  isLoading = false,
  error = null,
  onRetry,
  isEmpty = false,
  loading,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  children,
}: AsyncBoundaryProps) {
  if (isLoading) return <>{loading ?? <LoadingState />}</>;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (isEmpty) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  return <>{children}</>;
}
