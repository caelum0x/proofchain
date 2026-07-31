"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { fundDealSchema, type FundDealInput } from "@/lib/schemas";
import { getAddress } from "viem";
import { normalizeBytes32 } from "@/lib/hashing";
import { parseTokenInput } from "@/lib/amount";
import { escrowContract, usdcContract } from "@/lib/contracts";
import { contractAddresses } from "@/lib/shared";
import { getErrorMessage } from "@/lib/errors";
import { formatTokenAmount } from "@/lib/format";
import { useTx } from "@/hooks/useTx";
import { useUsdc } from "@/hooks/useUsdc";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";

/**
 * Approve MockUSDC and fund an escrow deal. The buyer first approves the escrow
 * to pull tokens, then funds — the UI shows whichever step is next.
 */
export function FundDealForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const escrowAddress = contractAddresses.settlementEscrow;
  const usdc = useUsdc(escrowAddress);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FundDealInput>({
    resolver: zodResolver(fundDealSchema),
    defaultValues: { batchId: "", supplier: "", amount: "" },
  });

  const approveTx = useTx({
    successLabel: "Approval confirmed",
    onConfirmed: () => usdc.refetch(),
  });
  const fundTx = useTx({
    successLabel: "Deal funded",
    onConfirmed: () => usdc.refetch(),
  });

  const amountInput = watch("amount");
  const parsed = parseTokenInput(amountInput || "", usdc.decimals);
  const needsApproval = parsed.value !== null && usdc.allowance < parsed.value;
  const insufficientBalance = parsed.value !== null && usdc.balance < parsed.value;

  // Approval only needs a valid amount — not the full deal form.
  const onApprove = async () => {
    setFormError(null);
    if (parsed.value === null) {
      setFormError(parsed.error ?? "Invalid amount");
      return;
    }
    if (!escrowAddress) {
      setFormError("Escrow is not deployed on this network.");
      return;
    }
    try {
      await approveTx.submit({
        ...usdcContract(),
        functionName: "approve",
        args: [escrowAddress, parsed.value],
      });
    } catch (error) {
      approveTx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  const onFund = handleSubmit(async (values) => {
    setFormError(null);
    if (parsed.value === null) {
      setFormError(parsed.error ?? "Invalid amount");
      return;
    }
    if (!usdc.token) {
      setFormError("MockUSDC is not deployed on this network.");
      return;
    }
    if (insufficientBalance) {
      setFormError("Insufficient MockUSDC balance.");
      return;
    }
    try {
      const batchId = normalizeBytes32(values.batchId);
      await fundTx.submit({
        ...escrowContract(),
        functionName: "fund",
        args: [batchId, getAddress(values.supplier), usdc.token, parsed.value],
      });
    } catch (error) {
      fundTx.reset();
      setFormError(getErrorMessage(error));
    }
  });

  const busy = approveTx.isBusy || fundTx.isBusy;

  return (
    <Card>
      <CardHeader
        title="Fund a deal"
        description="Escrow releases to the supplier only on a passing attestation."
        action={
          <div className="text-right text-xs text-muted">
            <div>
              Balance: {formatTokenAmount(usdc.balance, usdc.decimals)} {usdc.symbol}
            </div>
            <div>
              Allowance: {formatTokenAmount(usdc.allowance, usdc.decimals)} {usdc.symbol}
            </div>
          </div>
        }
      />
      <form noValidate onSubmit={(e) => e.preventDefault()}>
        <Field
          label="Batch id or reference"
          htmlFor="fund-batch"
          error={errors.batchId?.message}
        >
          <Input id="fund-batch" placeholder="0x… or reference" {...register("batchId")} />
        </Field>

        <Field label="Supplier address" htmlFor="fund-supplier" error={errors.supplier?.message}>
          <Input id="fund-supplier" placeholder="0x…" {...register("supplier")} />
        </Field>

        <Field
          label={`Amount (${usdc.symbol})`}
          htmlFor="fund-amount"
          error={errors.amount?.message ?? (amountInput ? parsed.error ?? undefined : undefined)}
        >
          <Input id="fund-amount" inputMode="decimal" placeholder="1000" {...register("amount")} />
        </Field>

        {insufficientBalance ? (
          <p className="field-error mb-3">Insufficient balance — use the faucet to mint test USDC.</p>
        ) : null}
        {formError ? <p className="field-error mb-3">{formError}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={onApprove}
            loading={approveTx.isBusy}
            disabled={busy || !needsApproval || parsed.value === null}
            variant={needsApproval ? "primary" : "secondary"}
          >
            {needsApproval ? "Approve" : "Approved"}
          </Button>
          <Button
            type="button"
            onClick={onFund}
            loading={fundTx.isBusy}
            disabled={busy || needsApproval || parsed.value === null}
          >
            {fundTx.isSigning
              ? "Confirm in wallet…"
              : fundTx.isPending
                ? "Funding…"
                : "Fund deal"}
          </Button>
        </div>

        {approveTx.hash ? (
          <p className="mt-3 text-xs text-muted">
            Approve tx: <TxLink hash={approveTx.hash} />
          </p>
        ) : null}
        {fundTx.hash ? (
          <p className="mt-1 text-xs text-muted">
            Fund tx: <TxLink hash={fundTx.hash} />
          </p>
        ) : null}
      </form>
    </Card>
  );
}
