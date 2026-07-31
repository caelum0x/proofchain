"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { PolicyState, policyStateLabel } from "@proofchain/shared";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { TxLink } from "@/components/ui/TxLink";
import { useTx } from "@/hooks/useTx";
import { contractRef } from "@/lib/contracts";
import { formatTokenAmount, shortenHex } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { policyStateTone, type PolicyRecord } from "@/lib/insurance";

interface PolicyCardProps {
  readonly policy: PolicyRecord;
  readonly decimals: number;
  readonly symbol: string;
  readonly onChanged?: () => void;
}

/** A policy summary with a cancel action for the holder of an active policy. */
export function PolicyCard({ policy, decimals, symbol, onChanged }: PolicyCardProps) {
  const { address: account } = useAccount();
  const [formError, setFormError] = useState<string | null>(null);
  const cancelTx = useTx({ successLabel: "Policy cancelled", onConfirmed: onChanged });

  const isHolder = Boolean(account && policy.holder && account.toLowerCase() === policy.holder.toLowerCase());
  const canCancel = isHolder && policy.state === PolicyState.Active;

  const onCancel = async () => {
    setFormError(null);
    try {
      await cancelTx.submit({ ...contractRef("PolicyManager"), functionName: "cancelPolicy", args: [policy.policyId] });
    } catch (error) {
      cancelTx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium text-fg" title={policy.policyId}>
            {shortenHex(policy.policyId, 6, 6)}
          </p>
          {policy.batchId ? (
            <Link href={`/invoices/${policy.batchId}`} className="mt-1 block font-mono text-xs text-brand hover:underline">
              batch {shortenHex(policy.batchId)}
            </Link>
          ) : null}
        </div>
        <Badge tone={policyStateTone(policy.state)}>{policyStateLabel(policy.state)}</Badge>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Coverage</dt>
          <dd className="mt-1 font-semibold text-fg">
            {formatTokenAmount(policy.coverage ?? 0n, decimals)} {symbol}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Premium paid</dt>
          <dd className="mt-1 font-semibold text-fg">
            {formatTokenAmount(policy.premium ?? 0n, decimals)} {symbol}
          </dd>
        </div>
      </dl>

      {policy.holder ? (
        <p className="flex items-center gap-1 text-xs text-muted">
          Holder <AddressBadge address={policy.holder} explorer={false} copyable={false} />
        </p>
      ) : null}

      {formError ? <p className="field-error">{formError}</p> : null}

      {canCancel ? (
        <div>
          <Button size="sm" variant="secondary" onClick={onCancel} loading={cancelTx.isBusy}>
            Cancel policy
          </Button>
          {cancelTx.hash ? <p className="mt-2 text-xs text-muted">Cancel: <TxLink hash={cancelTx.hash} /></p> : null}
        </div>
      ) : null}
    </Card>
  );
}
