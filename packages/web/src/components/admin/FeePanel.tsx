"use client";

import { useState } from "react";
import { useReadContract } from "wagmi";
import type { Hex } from "viem";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { hashString, isBytes32 } from "@/lib/hashing";
import { formatBps } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";

/** Read + set the protocol fee (bps) for an action key (e.g. "SETTLE"). */
export function FeePanel() {
  const fees = tryContractRef("FeeManager");
  const [action, setAction] = useState("SETTLE");
  const [bps, setBps] = useState("");
  const [error, setError] = useState<string | null>(null);

  const actionKey: Hex | undefined = action.trim()
    ? isBytes32(action.trim())
      ? (action.trim() as Hex)
      : hashString(action.trim())
    : undefined;

  const feeQuery = useReadContract({
    address: fees?.address,
    abi: fees?.abi,
    functionName: "feeBps",
    args: actionKey ? [actionKey] : undefined,
    query: { enabled: Boolean(fees && actionKey) },
  });

  const tx = useTx({ successLabel: "Fee updated", onConfirmed: () => feeQuery.refetch() });
  const current = feeQuery.data;

  const onSet = async () => {
    setError(null);
    if (!fees || !actionKey) return setError("Enter an action key.");
    const t = bps.trim();
    if (!/^\d+$/.test(t) || Number(t) > 10000) return setError("Enter bps between 0 and 10000.");
    try {
      await tx.submit({ address: fees.address, abi: fees.abi, functionName: "setFeeBps", args: [actionKey, Number(t)] });
    } catch (e) {
      tx.reset();
      setError(getErrorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Protocol fees"
        description="Fee in bps per action key (hashed from a label)."
        action={<span className="text-sm text-muted">{current !== undefined ? formatBps(Number(current)) : "—"}</span>}
      />
      {!fees ? (
        <p className="text-sm text-muted">FeeManager is not deployed on this network.</p>
      ) : (
        <>
          <Field label="Action (label or 0x… key)" htmlFor="fee-action">
            <Input id="fee-action" placeholder="SETTLE" value={action} onChange={(e) => setAction(e.target.value)} />
          </Field>
          <Field label="Fee (bps)" htmlFor="fee-bps">
            <Input id="fee-bps" inputMode="numeric" placeholder="50" value={bps} onChange={(e) => setBps(e.target.value)} />
          </Field>
          {error ? <p className="field-error mb-3">{error}</p> : null}
          <Button onClick={onSet} loading={tx.isBusy}>
            Set fee
          </Button>
          {tx.hash ? (
            <p className="mt-3 text-xs text-muted">
              Tx: <TxLink hash={tx.hash} />
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}
