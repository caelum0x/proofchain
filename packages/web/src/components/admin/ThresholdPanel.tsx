"use client";

import { useState } from "react";
import { useReadContract } from "wagmi";
import { escrowContract } from "@/lib/contracts";
import { contractAddresses } from "@/lib/shared";
import { settlementEscrowAbi } from "@/lib/abis";
import { useTx } from "@/hooks/useTx";
import { formatBps } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";

/** Read + update the escrow pass threshold (bps) required to release funds. */
export function ThresholdPanel() {
  const escrow = contractAddresses.settlementEscrow;
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const thresholdQuery = useReadContract({
    address: escrow,
    abi: settlementEscrowAbi,
    functionName: "passThreshold",
    query: { enabled: Boolean(escrow) },
  });

  const tx = useTx({ successLabel: "Threshold updated", onConfirmed: () => thresholdQuery.refetch() });
  const current = thresholdQuery.data;

  const onSet = async () => {
    setError(null);
    const t = value.trim();
    if (!/^\d+$/.test(t)) return setError("Enter a whole number of basis points (0–10000).");
    const bps = Number(t);
    if (bps < 0 || bps > 10000) return setError("Threshold must be between 0 and 10000 bps.");
    if (!escrow) return setError("SettlementEscrow is not deployed.");
    try {
      await tx.submit({ ...escrowContract(), functionName: "setPassThreshold", args: [bps] });
    } catch (e) {
      tx.reset();
      setError(getErrorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Pass threshold"
        description="Minimum attestation score to auto-release escrow."
        action={<span className="text-sm text-muted">{current !== undefined ? formatBps(Number(current)) : "—"}</span>}
      />
      {!escrow ? (
        <p className="text-sm text-muted">SettlementEscrow is not deployed on this network.</p>
      ) : (
        <>
          <Field label="New threshold (bps)" htmlFor="threshold" hint="0–10000; 7000 = 70%">
            <Input id="threshold" inputMode="numeric" placeholder="7000" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          {error ? <p className="field-error mb-3">{error}</p> : null}
          <Button onClick={onSet} loading={tx.isBusy}>
            Update threshold
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
