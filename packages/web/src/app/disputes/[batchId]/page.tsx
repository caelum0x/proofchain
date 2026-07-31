"use client";

import { useParams } from "next/navigation";
import type { Hex } from "viem";
import { isBytes32 } from "@/lib/hashing";
import { useDispute } from "@/hooks/useDisputes";
import { VotePanel } from "@/components/disputes/VotePanel";
import { ArbiterPanel } from "@/components/disputes/ArbiterPanel";
import { DisputeStateBadge } from "@/components/disputes/DisputeStateBadge";
import { RequireWallet } from "@/components/RequireWallet";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AddressLink } from "@/components/ui/TxLink";
import { ErrorState, LoadingState } from "@/components/ui/States";
import {
  dealStateLabel,
  dealStateTone,
  explorerAddressUrl,
  formatBps,
  formatTimestamp,
  formatTokenAmount,
  shortenHex,
} from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";

const DEAL_TOKEN_DECIMALS = 6;

export default function DisputeDetailPage() {
  const params = useParams<{ batchId: string }>();
  const raw = Array.isArray(params.batchId) ? params.batchId[0] : params.batchId;
  const batchId = raw && isBytes32(raw) ? (raw as Hex) : undefined;

  const { deal, dispute, score, passThreshold, hasVoted, isLoading, isError, error, refetch } =
    useDispute(batchId);

  if (!batchId) {
    return (
      <ErrorState title="Invalid batch id" message="The URL does not contain a valid 32-byte batch id." />
    );
  }

  const totalVotes = (dispute?.votesRefund ?? 0) + (dispute?.votesRelease ?? 0);
  const refundShare = totalVotes > 0 ? Math.round(((dispute?.votesRefund ?? 0) / totalVotes) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dispute</h1>
          <a
            href={explorerAddressUrl(batchId)}
            target="_blank"
            rel="noreferrer noopener"
            className="font-mono text-xs text-brand hover:underline"
          >
            {shortenHex(batchId, 10, 8)}
          </a>
        </div>
        {dispute ? <DisputeStateBadge state={dispute.state} /> : null}
      </div>

      {isLoading ? (
        <LoadingState label="Loading dispute state…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Deal"
                action={deal ? <Badge tone={dealStateTone(deal.state)}>{dealStateLabel(deal.state)}</Badge> : null}
              />
              {deal && deal.state !== 0 ? (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Buyer">
                    <AddressLink address={deal.buyer} />
                  </Info>
                  <Info label="Supplier">
                    <AddressLink address={deal.supplier} />
                  </Info>
                  <Info label="Amount">{formatTokenAmount(deal.amount, DEAL_TOKEN_DECIMALS)}</Info>
                  <Info label="Attestation">
                    {score !== undefined ? formatBps(score) : "—"}
                    {passThreshold !== undefined ? ` / ${formatBps(passThreshold)} req` : ""}
                  </Info>
                </dl>
              ) : (
                <p className="text-sm text-muted">No funded deal exists for this batch.</p>
              )}
            </Card>

            <Card>
              <CardHeader title="Arbiter votes" />
              {dispute && dispute.state !== 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Refund buyer: {dispute.votesRefund}</span>
                    <span>Release supplier: {dispute.votesRelease}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full bg-danger" style={{ width: `${refundShare}%` }} />
                  </div>
                  <p className="text-xs text-muted">
                    Opened {formatTimestamp(dispute.openedAt)} · {totalVotes} vote(s) cast
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  No arbitration opened yet. Anyone can open a dispute on a flagged deal.
                </p>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Actions" description="Open, vote, or resolve — access is enforced on-chain." />
              <RequireWallet>
                <VotePanel
                  batchId={batchId}
                  deal={deal}
                  dispute={dispute}
                  hasVoted={hasVoted}
                  onDone={refetch}
                />
              </RequireWallet>
            </Card>

            <RequireWallet>
              <ArbiterPanel />
            </RequireWallet>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-fg">{children}</dd>
    </div>
  );
}
