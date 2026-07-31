"use client";

import { useState } from "react";
import { ClaimState, claimStateLabel } from "@proofchain/shared";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { TxLink } from "@/components/ui/TxLink";
import { useTx } from "@/hooks/useTx";
import { contractRef } from "@/lib/contracts";
import { formatTokenAmount, shortenHex } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { claimStateTone, type ClaimRecord } from "@/lib/insurance";

interface ClaimCardProps {
  readonly claim: ClaimRecord;
  readonly decimals: number;
  readonly symbol: string;
  /** Whether the connected account holds ARBITER_ROLE (enables approve/reject). */
  readonly isArbiter: boolean;
  readonly onChanged?: () => void;
}

/**
 * A claim summary. Arbiters approve/reject filed claims; approved claims can be
 * paid out from the insurance pool.
 */
export function ClaimCard({ claim, decimals, symbol, isArbiter, onChanged }: ClaimCardProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const approveTx = useTx({ successLabel: "Claim approved", onConfirmed: onChanged });
  const rejectTx = useTx({ successLabel: "Claim rejected", onConfirmed: onChanged });
  const payoutTx = useTx({ successLabel: "Claim paid out", onConfirmed: onChanged });
  const busy = approveTx.isBusy || rejectTx.isBusy || payoutTx.isBusy;

  const act = async (tx: ReturnType<typeof useTx>, fn: string) => {
    setFormError(null);
    try {
      await tx.submit({ ...contractRef("ClaimsProcessor"), functionName: fn, args: [claim.claimId] });
    } catch (error) {
      tx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium text-fg" title={claim.claimId}>
            {shortenHex(claim.claimId, 6, 6)}
          </p>
          {claim.policyId ? (
            <p className="mt-1 font-mono text-xs text-muted">policy {shortenHex(claim.policyId)}</p>
          ) : null}
        </div>
        <Badge tone={claimStateTone(claim.state)}>{claimStateLabel(claim.state)}</Badge>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-muted">Claim amount</span>
        <span className="text-lg font-semibold text-fg">
          {formatTokenAmount(claim.amount ?? 0n, decimals)} {symbol}
        </span>
      </div>

      {claim.claimant ? (
        <p className="flex items-center gap-1 text-xs text-muted">
          Claimant <AddressBadge address={claim.claimant} explorer={false} copyable={false} />
        </p>
      ) : null}

      {formError ? <p className="field-error">{formError}</p> : null}

      <div className="flex flex-wrap gap-2">
        {isArbiter && claim.state === ClaimState.Filed ? (
          <>
            <Button size="sm" onClick={() => act(approveTx, "approveClaim")} loading={approveTx.isBusy} disabled={busy}>
              Approve
            </Button>
            <Button size="sm" variant="danger" onClick={() => act(rejectTx, "rejectClaim")} loading={rejectTx.isBusy} disabled={busy}>
              Reject
            </Button>
          </>
        ) : null}
        {claim.state === ClaimState.Approved ? (
          <Button size="sm" onClick={() => act(payoutTx, "payout")} loading={payoutTx.isBusy} disabled={busy}>
            Pay out
          </Button>
        ) : null}
        {claim.state === ClaimState.Paid ? <span className="text-sm text-success">Paid out</span> : null}
        {claim.state === ClaimState.Rejected ? <span className="text-sm text-danger">Rejected</span> : null}
      </div>

      <div className="space-y-1">
        {approveTx.hash ? <p className="text-xs text-muted">Approve: <TxLink hash={approveTx.hash} /></p> : null}
        {payoutTx.hash ? <p className="text-xs text-muted">Payout: <TxLink hash={payoutTx.hash} /></p> : null}
      </div>
    </Card>
  );
}
