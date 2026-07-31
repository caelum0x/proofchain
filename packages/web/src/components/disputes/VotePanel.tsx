"use client";

import { useState } from "react";
import type { Hex } from "viem";
import { useTx } from "@/hooks/useTx";
import { useArbiterStatus, ArbDisputeState, type DisputeDetail } from "@/hooks/useDisputes";
import { tryContractRef } from "@/lib/contracts";
import { getErrorMessage } from "@/lib/errors";
import { DealState, type DealView } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";

/**
 * Arbitration actions for one disputed deal: open the dispute, cast an arbiter
 * vote (refund the buyer vs. release to the supplier), and resolve once voting
 * closes. Every guard mirrors the on-chain contract; reverts are surfaced.
 */
export function VotePanel({
  batchId,
  deal,
  dispute,
  hasVoted,
  onDone,
}: {
  batchId: Hex;
  deal: DealView | null;
  dispute: DisputeDetail | null;
  hasVoted: boolean;
  onDone: () => void;
}) {
  const arb = tryContractRef("DisputeArbitration");
  const { isArbiter } = useArbiterStatus();
  const [error, setError] = useState<string | null>(null);

  const openTx = useTx({ successLabel: "Dispute opened", onConfirmed: onDone });
  const voteTx = useTx({ successLabel: "Vote cast", onConfirmed: onDone });
  const resolveTx = useTx({ successLabel: "Dispute resolved", onConfirmed: onDone });

  if (!arb) {
    return <p className="text-sm text-muted">The DisputeArbitration contract is not deployed on this network.</p>;
  }

  const state = dispute?.state ?? ArbDisputeState.None;
  const dealDisputed = deal?.state === DealState.Disputed;
  const canOpen = dealDisputed && state === ArbDisputeState.None;
  const canVote = state === ArbDisputeState.Open && isArbiter && !hasVoted;
  const canResolve = state === ArbDisputeState.Open;

  const run = async (
    tx: ReturnType<typeof useTx>,
    functionName: string,
    args: readonly unknown[],
  ) => {
    setError(null);
    try {
      await tx.submit({ address: arb.address, abi: arb.abi, functionName, args });
    } catch (e) {
      tx.reset();
      setError(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-3">
      {!dealDisputed && state === ArbDisputeState.None ? (
        <p className="text-sm text-muted">
          This deal is not in a disputed state, so no arbitration is required.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canOpen ? (
          <Button onClick={() => run(openTx, "openDispute", [batchId])} loading={openTx.isBusy}>
            Open dispute
          </Button>
        ) : null}

        {state === ArbDisputeState.Open ? (
          <>
            <Button
              onClick={() => run(voteTx, "vote", [batchId, true])}
              loading={voteTx.isBusy}
              disabled={!canVote}
              variant="danger"
            >
              Vote: refund buyer
            </Button>
            <Button
              onClick={() => run(voteTx, "vote", [batchId, false])}
              loading={voteTx.isBusy}
              disabled={!canVote}
            >
              Vote: release supplier
            </Button>
            <Button
              variant="secondary"
              onClick={() => run(resolveTx, "resolve", [batchId])}
              loading={resolveTx.isBusy}
              disabled={!canResolve}
            >
              Resolve
            </Button>
          </>
        ) : null}
      </div>

      {state === ArbDisputeState.Open && !isArbiter ? (
        <p className="text-xs text-muted">Only staked arbiters can vote. Stake below to participate.</p>
      ) : null}
      {state === ArbDisputeState.Open && isArbiter && hasVoted ? (
        <p className="text-xs text-muted">You have already voted on this dispute.</p>
      ) : null}
      {state === ArbDisputeState.Resolved ? (
        <p className="text-sm text-success">
          Resolved — {dispute?.refundedBuyer ? "funds refunded to the buyer." : "funds released to the supplier/payee."}
        </p>
      ) : null}

      {error ? <p className="field-error">{error}</p> : null}
      {[openTx.hash, voteTx.hash, resolveTx.hash].filter(Boolean).map((hash) => (
        <p key={hash} className="text-xs text-muted">
          Tx: <TxLink hash={hash as string} />
        </p>
      ))}
    </div>
  );
}
