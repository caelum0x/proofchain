"use client";

import { useState } from "react";
import { useCarbonProject } from "@/hooks/useCarbon";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";

/**
 * Permanently retire carbon credits the caller holds for a project id. Retiring
 * burns the credits and is irreversible; the total retired is tracked on-chain.
 */
export function RetireForm() {
  const carbon = tryContractRef("CarbonCreditToken");
  const [projectId, setProjectId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const project = useCarbonProject(parseId(projectId));
  const tx = useTx({ successLabel: "Credits retired", onConfirmed: () => project.refetch() });

  const onRetire = async () => {
    setError(null);
    const id = parseId(projectId);
    const amt = parseAmount(amount);
    if (id === undefined) return setError("Enter a valid project id.");
    if (amt === undefined) return setError("Enter a positive whole amount.");
    if (project.balance < amt) return setError("Amount exceeds your credit balance.");
    if (!carbon) return setError("CarbonCreditToken is not deployed.");
    try {
      await tx.submit({ address: carbon.address, abi: carbon.abi, functionName: "retire", args: [id, amt] });
    } catch (e) {
      tx.reset();
      setError(getErrorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader title="Retire credits" description="Burn credits you hold to claim the offset." />
      <Field label="Project id" htmlFor="retire-project">
        <Input
          id="retire-project"
          inputMode="numeric"
          placeholder="1"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        />
      </Field>
      {parseId(projectId) !== undefined ? (
        <p className="mb-3 text-xs text-muted">
          Your balance: {project.balance.toString()} · total retired: {project.retired.toString()}
        </p>
      ) : null}
      <Field label="Amount" htmlFor="retire-amount">
        <Input
          id="retire-amount"
          inputMode="numeric"
          placeholder="10"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      {error ? <p className="field-error mb-3">{error}</p> : null}
      <Button onClick={onRetire} loading={tx.isBusy}>
        Retire
      </Button>
      {tx.hash ? (
        <p className="mt-3 text-xs text-muted">
          Tx: <TxLink hash={tx.hash} />
        </p>
      ) : null}
    </Card>
  );
}

function parseId(v: string): bigint | undefined {
  const t = v.trim();
  return /^\d+$/.test(t) ? BigInt(t) : undefined;
}
function parseAmount(v: string): bigint | undefined {
  const t = v.trim();
  if (!/^\d+$/.test(t)) return undefined;
  const n = BigInt(t);
  return n > 0n ? n : undefined;
}
