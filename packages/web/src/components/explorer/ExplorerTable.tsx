"use client";

import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { dealStateLabel, dealStateTone, formatBps, shortenHex } from "@/lib/format";
import { DealState } from "@/lib/types";
import type { BatchRegisteredEvent } from "@/lib/types";
import type { BatchStatus } from "@/hooks/useBatchStatuses";

interface ExplorerTableProps {
  readonly batches: readonly BatchRegisteredEvent[];
  readonly statuses: ReadonlyMap<string, BatchStatus>;
  readonly passThreshold: number;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error?: string | null;
  readonly onRetry?: () => void;
}

/**
 * The batch explorer table: registration, supplier, live attestation verdict,
 * and settlement state for each batch. Attestation/settlement come from
 * {@link BatchStatus} (a per-page multicall); rows link to the batch detail.
 */
export function ExplorerTable({
  batches,
  statuses,
  passThreshold,
  isLoading,
  isError,
  error,
  onRetry,
}: ExplorerTableProps) {
  const router = useRouter();

  const columns: readonly Column<BatchRegisteredEvent>[] = [
    {
      id: "batchId",
      header: "Batch",
      cell: (row) => <span className="font-mono text-xs">{shortenHex(row.batchId, 8, 6)}</span>,
    },
    {
      id: "supplier",
      header: "Supplier",
      className: "hidden sm:table-cell",
      cell: (row) => <AddressBadge address={row.supplier} copyable={false} />,
    },
    {
      id: "attestation",
      header: "Attestation",
      cell: (row) => {
        const status = statuses.get(row.batchId.toLowerCase());
        if (!status) return <span className="text-xs text-muted">…</span>;
        if (!status.attested) return <Badge tone="neutral">Pending</Badge>;
        const passed = (status.score ?? 0) >= passThreshold;
        return (
          <Badge tone={passed ? "success" : "danger"}>
            {status.score !== undefined ? formatBps(status.score) : "—"} · {passed ? "PASS" : "FAIL"}
          </Badge>
        );
      },
    },
    {
      id: "settlement",
      header: "Settlement",
      align: "right",
      cell: (row) => {
        const status = statuses.get(row.batchId.toLowerCase());
        const state = status?.dealState ?? DealState.None;
        if (state === DealState.None) return <span className="text-xs text-muted">—</span>;
        return <Badge tone={dealStateTone(state)}>{dealStateLabel(state)}</Badge>;
      },
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
      emptyTitle="No batches registered yet"
      emptyDescription="Register a batch from the Supplier screen to see it here."
    />
  );
}
