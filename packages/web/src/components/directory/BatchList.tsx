"use client";

import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { shortenHex } from "@/lib/format";
import type { BatchRegisteredEvent } from "@/lib/types";
import { MetadataLink } from "./MetadataLink";

/**
 * Table of batches registered by an actor. Rows link to the batch explorer
 * detail page. Loading / error / empty states are delegated to {@link DataTable}.
 */
export function BatchList({
  batches,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  batches: readonly BatchRegisteredEvent[];
  isLoading: boolean;
  isError: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const router = useRouter();

  const columns: readonly Column<BatchRegisteredEvent>[] = [
    {
      id: "batchId",
      header: "Batch",
      cell: (row) => <span className="font-mono text-xs">{shortenHex(row.batchId, 8, 6)}</span>,
    },
    {
      id: "metadata",
      header: "Metadata",
      className: "hidden md:table-cell",
      cell: (row) =>
        row.metadataURI ? (
          <span className="max-w-[240px] truncate">
            <MetadataLink uri={row.metadataURI} className="text-xs text-brand hover:underline" />
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      id: "go",
      header: "",
      align: "right",
      cell: () => <span className="text-xs text-brand">View →</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={batches}
      getRowKey={(row) => row.batchId}
      onRowClick={(row) => router.push(`/explorer/${row.batchId}`)}
      isLoading={isLoading}
      error={isError ? (error ?? "Failed to load batches.") : null}
      onRetry={onRetry}
      emptyTitle="No batches"
      emptyDescription="This account has not registered any batches yet."
    />
  );
}
