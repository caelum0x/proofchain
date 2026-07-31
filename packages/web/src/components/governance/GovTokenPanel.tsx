"use client";

import { useState } from "react";
import { useGovToken } from "@/hooks/useGovernance";
import { useTx } from "@/hooks/useTx";
import { formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { TxLink } from "@/components/ui/TxLink";

const PROOF_DECIMALS = 18;

/**
 * Voting-power panel. ERC20Votes only counts votes once delegated, so this shows
 * the account's balance vs. active voting power and offers a self-delegation
 * action — without it, a holder's votes are zero.
 */
export function GovTokenPanel() {
  const gov = useGovToken();
  const [error, setError] = useState<string | null>(null);
  const delegateTx = useTx({ successLabel: "Delegated voting power", onConfirmed: () => gov.refetch() });

  const onDelegate = async () => {
    setError(null);
    if (!gov.token || !gov.account) return setError("Connect a wallet first.");
    try {
      await delegateTx.submit({
        address: gov.token.address,
        abi: gov.token.abi,
        functionName: "delegate",
        args: [gov.account],
      });
    } catch (e) {
      delegateTx.reset();
      setError(getErrorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Your voting power"
        action={
          gov.isSelfDelegated ? (
            <Badge tone="success">Delegated</Badge>
          ) : (
            <Badge tone="warn">Not delegated</Badge>
          )
        }
      />
      <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">{gov.symbol} balance</dt>
          <dd className="mt-0.5 font-medium text-fg">{formatTokenAmount(gov.balance, PROOF_DECIMALS)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Voting power</dt>
          <dd className="mt-0.5 font-medium text-fg">{formatTokenAmount(gov.votes, PROOF_DECIMALS)}</dd>
        </div>
      </dl>

      {gov.hasDelegated && gov.delegate ? (
        <p className="mb-3 text-xs text-muted">
          Delegated to <AddressBadge address={gov.delegate} />
        </p>
      ) : null}

      {!gov.isSelfDelegated ? (
        <>
          <Button onClick={onDelegate} loading={delegateTx.isBusy} disabled={gov.balance === 0n}>
            Delegate to self to vote
          </Button>
          {gov.balance === 0n ? (
            <p className="mt-2 text-xs text-muted">You need {gov.symbol} tokens to gain voting power.</p>
          ) : null}
        </>
      ) : null}

      {error ? <p className="field-error mt-3">{error}</p> : null}
      {delegateTx.hash ? (
        <p className="mt-3 text-xs text-muted">
          Tx: <TxLink hash={delegateTx.hash} />
        </p>
      ) : null}
    </Card>
  );
}
