"use client";

import { useState } from "react";
import { useTx } from "@/hooks/useTx";
import { useGovToken, ProposalState, VoteSupport } from "@/hooks/useGovernance";
import { tryContractRef } from "@/lib/contracts";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { TxLink } from "@/components/ui/TxLink";

/**
 * Cast a vote (For / Against / Abstain) on an active proposal, with an optional
 * on-chain reason. Gated exactly as the Governor: only Active proposals, and only
 * accounts that have not already voted with non-zero delegated voting power.
 */
export function CastVotePanel({
  proposalId,
  state,
  hasVoted,
  onDone,
}: {
  proposalId: string;
  state: number | undefined;
  hasVoted: boolean;
  onDone: () => void;
}) {
  const gov = tryContractRef("ProofChainGovernor");
  const token = useGovToken();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const voteTx = useTx({ successLabel: "Vote recorded", onConfirmed: onDone });

  if (!gov) return <p className="text-sm text-muted">Governor is not deployed on this network.</p>;

  const isActive = state === ProposalState.Active;
  const canVote = isActive && !hasVoted && token.votes > 0n;

  const vote = async (support: number) => {
    setError(null);
    try {
      const trimmed = reason.trim();
      if (trimmed.length > 0) {
        await voteTx.submit({
          address: gov.address,
          abi: gov.abi,
          functionName: "castVoteWithReason",
          args: [BigInt(proposalId), support, trimmed],
        });
      } else {
        await voteTx.submit({
          address: gov.address,
          abi: gov.abi,
          functionName: "castVote",
          args: [BigInt(proposalId), support],
        });
      }
    } catch (e) {
      voteTx.reset();
      setError(getErrorMessage(e));
    }
  };

  if (!isActive) {
    return <p className="text-sm text-muted">Voting is only open while a proposal is Active.</p>;
  }

  return (
    <div className="space-y-3">
      <Field label="Reason (optional, on-chain)" htmlFor="vote-reason">
        <Textarea
          id="vote-reason"
          placeholder="Why you're voting this way…"
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => vote(VoteSupport.For)} loading={voteTx.isBusy} disabled={!canVote}>
          Vote For
        </Button>
        <Button variant="danger" onClick={() => vote(VoteSupport.Against)} loading={voteTx.isBusy} disabled={!canVote}>
          Vote Against
        </Button>
        <Button variant="secondary" onClick={() => vote(VoteSupport.Abstain)} loading={voteTx.isBusy} disabled={!canVote}>
          Abstain
        </Button>
      </div>

      {hasVoted ? <p className="text-xs text-muted">You have already voted on this proposal.</p> : null}
      {!hasVoted && token.votes === 0n ? (
        <p className="text-xs text-muted">You have no voting power. Delegate {token.symbol} to yourself first.</p>
      ) : null}

      {error ? <p className="field-error">{error}</p> : null}
      {voteTx.hash ? (
        <p className="text-xs text-muted">
          Tx: <TxLink hash={voteTx.hash} />
        </p>
      ) : null}
    </div>
  );
}
