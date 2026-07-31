"use client";

import { cn } from "@/lib/cn";
import { Button } from "./Button";

interface PaginationProps {
  /** Zero-based current page index. */
  readonly page: number;
  /** Items per page. */
  readonly limit: number;
  /** Total item count across all pages. */
  readonly total: number;
  readonly onPageChange: (page: number) => void;
  readonly className?: string;
}

/**
 * Page controls for API-paginated lists. Derives page count from `total`/`limit`
 * and clamps navigation so callers never receive an out-of-range page. Renders
 * nothing when there is a single page (or no items).
 */
export function Pagination({ page, limit, total, onPageChange, className }: PaginationProps) {
  const safeLimit = Math.max(1, limit);
  const pageCount = Math.max(1, Math.ceil(total / safeLimit));
  const current = Math.min(Math.max(0, page), pageCount - 1);

  if (pageCount <= 1) return null;

  const from = total === 0 ? 0 : current * safeLimit + 1;
  const to = Math.min(total, (current + 1) * safeLimit);

  const go = (next: number) => {
    const clamped = Math.min(Math.max(0, next), pageCount - 1);
    if (clamped !== current) onPageChange(clamped);
  };

  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <p className="text-xs text-muted">
        Showing <span className="text-fg">{from}</span>–<span className="text-fg">{to}</span> of{" "}
        <span className="text-fg">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => go(current - 1)}
          disabled={current === 0}
          aria-label="Previous page"
        >
          Prev
        </Button>
        <span className="text-xs text-muted">
          Page {current + 1} / {pageCount}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => go(current + 1)}
          disabled={current >= pageCount - 1}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
