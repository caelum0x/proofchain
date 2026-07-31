"use client";

import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import {
  dealStateLabel,
  dealStateTone,
  formatTokenAmount,
  shortenHex,
} from "@/lib/format";
import type { DealView } from "@/lib/types";

const USDC_DECIMALS = 6;

/**
 * Table of escrow deals for an actor (buyer or supplier). Amounts are shown in
 * whole-token units (6-decimal USDC) and rows link to the deal/explorer detail.
 */
export function DealList({
  deals,
  counterpartyLabel,
  counterparty,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  deals: readonly DealView[];
  /** Header for the counterparty column, e.g. "Supplier" (for a buyer's deals). */
  counterpartyLabel: string;
  /** Which side of the deal to show in that column. */
  counterparty: "buyer" | "supplier";
  isLoading: boolean;
  isError: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const router = useRouter();

  const columns: readonly Column<DealView>[] = [
    {
      id: "batchId",
      header: "Batch",
      cell: (row) => <span className="font-mono text-xs">{shortenHex(row.batchId, 8, 6)}</span>,
    },
    {
      id: "counterparty",
      header: counterpartyLabel,
      className: "hidden sm:table-cell",
      cell: (row) => <AddressBadge address={row[counterparty]} copyable={false} />,
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      cell: (row) => (
        <span className="tabular-nums">{formatTokenAmount(row.amount, USDC_DECIMALS)} USDC</span>
      ),
    },
    {
      id: "state",
      header: "State",
      align: "right",
      cell: (row) => <Badge tone={dealStateTone(row.state)}>{dealStateLabel(row.state)}</Badge>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={deals}
      getRowKey={(row) => row.batchId}
      onRowClick={(row) => router.push(`/deals/${row.batchId}`)}
      isLoading={isLoading}
      error={isError ? (error ?? "Failed to load deals.") : null}
      onRetry={onRetry}
      emptyTitle="No deals"
      emptyDescription="This account has no escrow deals yet."
    />
  );
}
