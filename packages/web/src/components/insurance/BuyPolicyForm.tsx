"use client";

import { useState } from "react";
import type { Abi } from "viem";
import { useReadContract } from "wagmi";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";
import { useTx } from "@/hooks/useTx";
import { useUsdc } from "@/hooks/useUsdc";
import { getAbi } from "@/lib/abis";
import { contractRef, usdcContract } from "@/lib/contracts";
import { getResolvedAddress } from "@/lib/shared";
import { normalizeBytes32 } from "@/lib/hashing";
import { parseTokenInput } from "@/lib/amount";
import { formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";

const POLICY_ABI = getAbi("PolicyManager") as Abi;

interface BuyPolicyFormProps {
  readonly onIssued?: () => void;
}

/**
 * Buy a policy covering a batch. The premium is quoted live from the
 * PremiumCalculator (via PolicyManager.quote); the holder approves the premium
 * then purchases in one guided flow.
 */
export function BuyPolicyForm({ onIssued }: BuyPolicyFormProps) {
  const usdc = useUsdc();
  const policyAddr = getResolvedAddress("PolicyManager");
  const token = getResolvedAddress("MockUSDC");
  const [batchIdInput, setBatchIdInput] = useState("");
  const [coverage, setCoverage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const approveTx = useTx({ successLabel: "Premium approved", onConfirmed: () => usdc.refetch() });
  const buyTx = useTx({ successLabel: "Policy issued", onConfirmed: onIssued });

  const trimmedBatch = batchIdInput.trim();
  const batchId = trimmedBatch.length > 0 ? normalizeBytes32(trimmedBatch) : undefined;
  const parsedCoverage = parseTokenInput(coverage || "", usdc.decimals);
  const coverageValue = parsedCoverage.value;

  const quoteQ = useReadContract({
    address: policyAddr,
    abi: POLICY_ABI,
    functionName: "quote",
    args: batchId && coverageValue !== null ? [batchId, coverageValue] : undefined,
    query: { enabled: Boolean(policyAddr && batchId && coverageValue !== null) },
  });
  const premium = (quoteQ.data as bigint | undefined) ?? null;
  const needsApproval = premium !== null && usdc.allowance < premium;
  const busy = approveTx.isBusy || buyTx.isBusy;

  const onApprove = async () => {
    setFormError(null);
    if (premium === null || !policyAddr) return;
    try {
      await approveTx.submit({ ...usdcContract(), functionName: "approve", args: [policyAddr, premium] });
    } catch (error) {
      approveTx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  const onBuy = async () => {
    setFormError(null);
    if (!batchId) {
      setFormError("Enter a batch id or reference.");
      return;
    }
    if (coverageValue === null) {
      setFormError(parsedCoverage.error ?? "Enter a coverage amount.");
      return;
    }
    if (!token) {
      setFormError("Settlement token is not configured on this network.");
      return;
    }
    if (premium !== null && usdc.balance < premium) {
      setFormError(`Insufficient ${usdc.symbol} for the premium.`);
      return;
    }
    try {
      await buyTx.submit({
        ...contractRef("PolicyManager"),
        functionName: "buyPolicy",
        args: [batchId, token, coverageValue],
      });
      setBatchIdInput("");
      setCoverage("");
    } catch (error) {
      buyTx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <Card>
      <CardHeader title="Buy a policy" description="Insure a shipment against loss or dispute." />
      <Field label="Batch id or reference" htmlFor="pol-batch">
        <Input id="pol-batch" placeholder="0x… or reference" value={batchIdInput} onChange={(e) => setBatchIdInput(e.target.value)} />
      </Field>
      <Field
        label={`Coverage (${usdc.symbol})`}
        htmlFor="pol-coverage"
        error={coverage ? parsedCoverage.error ?? undefined : undefined}
      >
        <Input id="pol-coverage" inputMode="decimal" placeholder="10000" value={coverage} onChange={(e) => setCoverage(e.target.value)} />
      </Field>

      <div className="mb-4 flex items-baseline justify-between rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-sm">
        <span className="text-muted">Premium</span>
        <span className="font-semibold text-fg">
          {quoteQ.isLoading ? "…" : premium !== null ? `${formatTokenAmount(premium, usdc.decimals)} ${usdc.symbol}` : "—"}
        </span>
      </div>

      {formError ? <p className="field-error mb-3">{formError}</p> : null}

      <div className="flex flex-wrap gap-2">
        {needsApproval ? (
          <Button onClick={onApprove} loading={approveTx.isBusy} disabled={busy || premium === null}>
            Approve premium
          </Button>
        ) : (
          <Button onClick={onBuy} loading={buyTx.isBusy} disabled={busy || premium === null}>
            Buy policy
          </Button>
        )}
      </div>
      {buyTx.hash ? <p className="mt-3 text-xs text-muted">Buy tx: <TxLink hash={buyTx.hash} /></p> : null}
    </Card>
  );
}
