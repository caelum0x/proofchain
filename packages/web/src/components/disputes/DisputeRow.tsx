"use client";

import Link from "next/link";
import type { Hex } from "viem";
import { useDispute } from "@/hooks/useDisputes";
import { AddressLink } from "@/components/ui/TxLink";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { DisputeStateBadge } from "./DisputeStateBadge";
import { dealStateLabel, dealStateTone, formatBps, formatTokenAmount, shortenHex } from "@/lib/format";

const DEAL_TOKEN_DECIMALS = 6; // deals settle in MockUSDC (6 decimals)

/**
 * One row of the disputes table. Reads the live escrow deal + arbitration record
 * for a batch flagged `Disputed` so the list always reflects current state.
 */
export function DisputeRow({ batchId, score }: { batchId: Hex; score: number }) {
  const { deal, dispute, isLoading } = useDispute(batchId);

  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-surface-2/40">
      <td className="px-4 py-3">
        <Link href={`/disputes/${batchId}`} className="font-mono text-xs text-brand hover:underline">
          {shortenHex(batchId, 10, 8)}
        </Link>
      </td>
      <td className="px-4 py-3">
        {deal ? <AddressLink address={deal.supplier} /> : <span className="text-muted">—</span>}
      </td>
      <td className="px-4 py-3 text-right">
        {deal ? `${formatTokenAmount(deal.amount, DEAL_TOKEN_DECIMALS)}` : "—"}
      </td>
      <td className="px-4 py-3">
        <Badge tone="danger">{formatBps(score)}</Badge>
      </td>
      <td className="px-4 py-3">
        {isLoading ? (
          <Spinner className="h-4 w-4 text-brand" />
        ) : deal ? (
          <Badge tone={dealStateTone(deal.state)}>{dealStateLabel(deal.state)}</Badge>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3">
        {dispute ? (
          <span className="inline-flex items-center gap-2">
            <DisputeStateBadge state={dispute.state} />
            {dispute.state !== 0 ? (
              <span className="text-xs text-muted">
                {dispute.votesRefund}↩ / {dispute.votesRelease}➡
              </span>
            ) : null}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <Link href={`/disputes/${batchId}`} className="text-xs text-brand hover:underline">
          View →
        </Link>
      </td>
    </tr>
  );
}
