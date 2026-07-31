"use client";

import { useMemo, type ReactNode } from "react";
import { DataTable, Pagination, type Column } from "@/components/ui";
import { ListToolbar, type StatusFacet } from "./ListToolbar";
import type { ListParamsApi } from "@/hooks/useT3ListParams";
import { PAGE_SIZE, paginate, sortRows, type SortKey } from "./list-utils";

export interface ComplianceListProps<T> {
  readonly params: ListParamsApi;
  readonly items: readonly T[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
  readonly columns: readonly Column<T>[];
  readonly getRowKey: (item: T) => string;
  readonly onRowClick?: (item: T) => void;
  /** Client-side predicate reflecting the URL search + status facet. */
  readonly filter: (item: T, query: string, status: string) => boolean;
  readonly sortKeyFor?: (id: string) => ((item: T) => SortKey) | undefined;
  readonly statusOptions?: readonly StatusFacet[];
  readonly searchPlaceholder?: string;
  readonly onExport?: (rows: readonly T[]) => void;
  readonly emptyTitle?: string;
  readonly emptyDescription?: ReactNode;
}

/**
 * Shared list body for the compliance trade-doc surfaces: URL-driven toolbar,
 * client-side filter/sort/paginate over an API dataset, and a typed DataTable
 * with built-in loading/empty/error layers (WD §3). Keeps every compliance list
 * behaving as the same machine with different columns.
 */
export function ComplianceList<T>({
  params,
  items,
  isLoading,
  error,
  onRetry,
  columns,
  getRowKey,
  onRowClick,
  filter,
  sortKeyFor,
  statusOptions,
  searchPlaceholder,
  onExport,
  emptyTitle = "Nothing to show",
  emptyDescription,
}: ComplianceListProps<T>) {
  const { q, status, sort, dir, page } = params.state;

  const filtered = useMemo(() => items.filter((item) => filter(item, q, status)), [items, q, status, filter]);
  const sorted = useMemo(
    () => (sortKeyFor ? sortRows(filtered, sortKeyFor, sort, dir) : filtered),
    [filtered, sortKeyFor, sort, dir],
  );
  const pageRows = useMemo(() => paginate(sorted, page), [sorted, page]);

  return (
    <div className="space-y-4">
      <ListToolbar
        params={params}
        statusOptions={statusOptions}
        searchPlaceholder={searchPlaceholder}
        onExport={onExport && sorted.length > 0 ? () => onExport(sorted) : undefined}
      />
      <DataTable
        columns={columns}
        rows={pageRows}
        getRowKey={getRowKey}
        onRowClick={onRowClick}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        sort={sort ? { id: sort, dir } : null}
        onSortChange={params.setSort}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />
      <Pagination page={page} limit={PAGE_SIZE} total={sorted.length} onPageChange={params.setPage} />
    </div>
  );
}
