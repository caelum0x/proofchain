"use client";

import { useState } from "react";
import type { Hex } from "viem";
import { useCarbonProject, useFootprint } from "@/hooks/useCarbon";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { normalizeBytes32 } from "@/lib/hashing";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";

/**
 * Offset a batch's measured footprint by retiring credits through the
 * OffsetMarketplace. The marketplace pulls the caller's ERC1155 credits, so a
 * one-time `setApprovalForAll` operator approval is required first.
 */
export function OffsetForm() {
  const carbon = tryContractRef("CarbonCreditToken");
  const market = tryContractRef("OffsetMarketplace");
  const [batchInput, setBatchInput] = useState("");
  const [projectId, setProjectId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const batchId: Hex | undefined = safeBytes32(batchInput);
  const footprint = useFootprint(batchId);
  const project = useCarbonProject(parseId(projectId));

  const approveTx = useTx({ successLabel: "Marketplace approved", onConfirmed: () => project.refetch() });
  const offsetTx = useTx({
    successLabel: "Footprint offset",
    onConfirmed: () => {
      footprint.refetch();
      project.refetch();
    },
  });

  const onApprove = async () => {
    setError(null);
    if (!carbon || !market) return setError("Carbon contracts are not deployed.");
    try {
      await approveTx.submit({
        address: carbon.address,
        abi: carbon.abi,
        functionName: "setApprovalForAll",
        args: [market.address, true],
      });
    } catch (e) {
      approveTx.reset();
      setError(getErrorMessage(e));
    }
  };

  const onOffset = async () => {
    setError(null);
    const id = parseId(projectId);
    const amt = parseAmount(amount);
    if (!batchId) return setError("Enter a valid batch id or reference.");
    if (id === undefined) return setError("Enter a valid project id.");
    if (amt === undefined) return setError("Enter a positive whole amount.");
    if (project.balance < amt) return setError("Amount exceeds your credit balance.");
    if (!market) return setError("OffsetMarketplace is not deployed.");
    try {
      await offsetTx.submit({ address: market.address, abi: market.abi, functionName: "offset", args: [batchId, id, amt] });
    } catch (e) {
      offsetTx.reset();
      setError(getErrorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader title="Offset a batch" description="Retire credits against a shipment's measured emissions." />
      <Field label="Batch id or reference" htmlFor="offset-batch">
        <Input id="offset-batch" placeholder="0x… or reference" value={batchInput} onChange={(e) => setBatchInput(e.target.value)} />
      </Field>
      {batchId ? (
        <p className="mb-3 text-xs text-muted">
          Remaining footprint: {footprint.remaining !== undefined ? `${footprint.remaining.toString()} g CO₂e` : "—"}
          {footprint.emissions !== undefined ? ` / ${footprint.emissions.toString()} total` : ""}
        </p>
      ) : null}
      <Field label="Project id" htmlFor="offset-project">
        <Input id="offset-project" inputMode="numeric" placeholder="1" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
      </Field>
      <Field label="Amount (credits)" htmlFor="offset-amount">
        <Input id="offset-amount" inputMode="numeric" placeholder="10" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      {parseId(projectId) !== undefined ? (
        <p className="mb-3 text-xs text-muted">Your balance: {project.balance.toString()} credits</p>
      ) : null}
      {error ? <p className="field-error mb-3">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {!project.approvedForOffset ? (
          <Button variant="primary" onClick={onApprove} loading={approveTx.isBusy}>
            Approve marketplace
          </Button>
        ) : null}
        <Button onClick={onOffset} loading={offsetTx.isBusy} disabled={!project.approvedForOffset}>
          Offset
        </Button>
      </div>
      {approveTx.hash ? (
        <p className="mt-3 text-xs text-muted">
          Approve tx: <TxLink hash={approveTx.hash} />
        </p>
      ) : null}
      {offsetTx.hash ? (
        <p className="mt-1 text-xs text-muted">
          Offset tx: <TxLink hash={offsetTx.hash} />
        </p>
      ) : null}
    </Card>
  );
}

function safeBytes32(v: string): Hex | undefined {
  const t = v.trim();
  if (!t) return undefined;
  try {
    return normalizeBytes32(t);
  } catch {
    return undefined;
  }
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
