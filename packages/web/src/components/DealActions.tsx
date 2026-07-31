"use client";

import { useState } from "react";
import type { Hex } from "viem";
import { escrowContract } from "@/lib/contracts";
import { getErrorMessage } from "@/lib/errors";
import { DealState, type DealView } from "@/lib/types";
import { useTx } from "@/hooks/useTx";
import { Button } from "./ui/Button";
import { TxLink } from "./ui/TxLink";

/**
 * Settlement actions for a deal. `settle` is permissionless (anyone can trigger
 * it once attested); `refund` is admin-only and shown when disputed — access
 * control is enforced on-chain and surfaced as an error if unauthorized.
 */
export function DealActions({
  batchId,
  deal,
  isAttested,
  onDone,
}: {
  batchId: Hex;
  deal: DealView | null;
  isAttested: boolean;
  onDone?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const settleTx = useTx({ successLabel: "Deal settled", onConfirmed: () => onDone?.() });
  const refundTx = useTx({ successLabel: "Deal refunded", onConfirmed: () => onDone?.() });

  const state = deal?.state ?? DealState.None;
  const canSettle = state === DealState.Funded;
  const canRefund = state === DealState.Disputed;

  if (state === DealState.None) return null;

  const onSettle = async () => {
    setError(null);
    try {
      await settleTx.submit({ ...escrowContract(), functionName: "settle", args: [batchId] });
    } catch (e) {
      settleTx.reset();
      setError(getErrorMessage(e));
    }
  };

  const onRefund = async () => {
    setError(null);
    try {
      await refundTx.submit({ ...escrowContract(), functionName: "refund", args: [batchId] });
    } catch (e) {
      refundTx.reset();
      setError(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canSettle ? (
          <Button onClick={onSettle} loading={settleTx.isBusy} disabled={!isAttested}>
            {isAttested ? "Settle" : "Awaiting attestation"}
          </Button>
        ) : null}
        {canRefund ? (
          <Button variant="danger" onClick={onRefund} loading={refundTx.isBusy}>
            Refund (admin)
          </Button>
        ) : null}
      </div>
      {settleTx.hash ? (
        <p className="text-xs text-muted">
          Settle tx: <TxLink hash={settleTx.hash} />
        </p>
      ) : null}
      {refundTx.hash ? (
        <p className="text-xs text-muted">
          Refund tx: <TxLink hash={refundTx.hash} />
        </p>
      ) : null}
      {error ? <p className="field-error">{error}</p> : null}
      {settleTx.error ? <p className="field-error">{settleTx.error}</p> : null}
      {refundTx.error ? <p className="field-error">{refundTx.error}</p> : null}
      {canSettle && !isAttested ? (
        <p className="text-xs text-muted">
          This deal can be settled once the AI agent posts an attestation.
        </p>
      ) : null}
    </div>
  );
}
