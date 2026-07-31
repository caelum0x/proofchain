"use client";

import { useState } from "react";
import type { Address } from "viem";
import { getAddress, isAddress } from "viem";
import { useGovToken } from "@/hooks/useGovernance";
import { useTx } from "@/hooks/useTx";
import { formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Callout } from "@/components/ui/Callout";
import { TxLink } from "@/components/ui/TxLink";

const PROOF_DECIMALS = 18;

/**
 * Governance voting power panel. Voting power only counts once delegated, so
 * this surfaces the connected holder's balance/votes and lets them self-delegate
 * (activate) or delegate to a representative.
 */
export function DelegatePanel() {
  const gov = useGovToken();
  const [delegatee, setDelegatee] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selfTx = useTx({ successLabel: "Voting power activated", onConfirmed: () => gov.refetch() });
  const delegateTx = useTx({ successLabel: "Delegated", onConfirmed: () => gov.refetch() });

  if (!gov.token) {
    return (
      <Card>
        <CardHeader title="Voting power" />
        <p className="text-sm text-muted">GovernanceToken is not deployed on this network.</p>
      </Card>
    );
  }

  const token = gov.token;

  const runDelegate = async (to: Address) => {
    setError(null);
    try {
      const tx = to.toLowerCase() === gov.account?.toLowerCase() ? selfTx : delegateTx;
      await tx.submit({
        address: token.address,
        abi: token.abi,
        functionName: "delegate",
        args: [to],
      });
    } catch (e) {
      selfTx.reset();
      delegateTx.reset();
      setError(getErrorMessage(e));
    }
  };

  const onDelegate = () => {
    if (!isAddress(delegatee)) return setError("Enter a valid delegatee address.");
    void runDelegate(getAddress(delegatee) as Address);
  };

  return (
    <Card>
      <CardHeader
        title="Voting power"
        description="Delegate PROOF to activate your votes."
        action={
          gov.isSelfDelegated ? (
            <Badge tone="success">Active</Badge>
          ) : gov.hasDelegated ? (
            <Badge tone="brand">Delegated</Badge>
          ) : (
            <Badge tone="warn">Inactive</Badge>
          )
        }
      />

      <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Balance</dt>
          <dd className="mt-0.5 font-mono font-medium text-fg">
            {formatTokenAmount(gov.balance, PROOF_DECIMALS)} {gov.symbol}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Votes</dt>
          <dd className="mt-0.5 font-mono font-medium text-fg">
            {formatTokenAmount(gov.votes, PROOF_DECIMALS)}
          </dd>
        </div>
      </dl>

      {gov.hasDelegated && gov.delegate ? (
        <p className="mb-4 flex items-center gap-2 text-sm text-muted">
          Delegated to <AddressBadge address={gov.delegate} />
        </p>
      ) : (
        <Callout tone="warn" className="mb-4">
          Your PROOF has no active voting power. Self-delegate to vote on proposals.
        </Callout>
      )}

      <div className="space-y-3">
        {!gov.isSelfDelegated && gov.account ? (
          <Button onClick={() => runDelegate(gov.account as Address)} loading={selfTx.isBusy}>
            Activate my votes (self-delegate)
          </Button>
        ) : null}

        <Field label="Delegate to representative" htmlFor="delegatee">
          <Input
            id="delegatee"
            placeholder="0x…"
            value={delegatee}
            onChange={(e) => setDelegatee(e.target.value)}
          />
        </Field>
        <Button variant="secondary" onClick={onDelegate} loading={delegateTx.isBusy}>
          Delegate
        </Button>

        {error ? <p className="field-error">{error}</p> : null}
        {[selfTx.hash, delegateTx.hash].filter(Boolean).map((hash) => (
          <p key={hash} className="text-xs text-muted">
            Tx: <TxLink hash={hash as string} />
          </p>
        ))}
      </div>
    </Card>
  );
}
