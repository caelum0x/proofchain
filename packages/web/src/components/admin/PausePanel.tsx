"use client";

import { useState } from "react";
import { useReadContract } from "wagmi";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TxLink } from "@/components/ui/TxLink";

/** Global pause guardian: reads paused state and toggles it (PAUSER_ROLE). */
export function PausePanel() {
  const pauser = tryContractRef("Pauser");
  const [error, setError] = useState<string | null>(null);

  const pausedQuery = useReadContract({
    address: pauser?.address,
    abi: pauser?.abi,
    functionName: "paused",
    query: { enabled: Boolean(pauser) },
  });

  const tx = useTx({ successLabel: "Pause state updated", onConfirmed: () => pausedQuery.refetch() });
  const paused = Boolean(pausedQuery.data);

  const toggle = async () => {
    setError(null);
    if (!pauser) return setError("Pauser is not deployed.");
    try {
      await tx.submit({
        address: pauser.address,
        abi: pauser.abi,
        functionName: paused ? "unpause" : "pause",
        args: [],
      });
    } catch (e) {
      tx.reset();
      setError(getErrorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Global pause"
        description="Halts sensitive actions across every module."
        action={paused ? <Badge tone="danger">Paused</Badge> : <Badge tone="success">Live</Badge>}
      />
      {!pauser ? (
        <p className="text-sm text-muted">Pauser is not deployed on this network.</p>
      ) : (
        <Button variant={paused ? "primary" : "danger"} onClick={toggle} loading={tx.isBusy}>
          {paused ? "Unpause protocol" : "Pause protocol"}
        </Button>
      )}
      {error ? <p className="field-error mt-3">{error}</p> : null}
      {tx.hash ? (
        <p className="mt-3 text-xs text-muted">
          Tx: <TxLink hash={tx.hash} />
        </p>
      ) : null}
    </Card>
  );
}
