"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAccount } from "wagmi";
import { faucetSchema, type FaucetInput } from "@/lib/schemas";
import { parseTokenInput } from "@/lib/amount";
import { usdcContract } from "@/lib/contracts";
import { getErrorMessage } from "@/lib/errors";
import { useTx } from "@/hooks/useTx";
import { useUsdc } from "@/hooks/useUsdc";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

/** Mint test MockUSDC to the connected account (test networks only). */
export function FaucetForm() {
  const { address } = useAccount();
  const usdc = useUsdc();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FaucetInput>({
    resolver: zodResolver(faucetSchema),
    defaultValues: { amount: "1000" },
  });

  const tx = useTx({
    successLabel: "Minted MockUSDC",
    onConfirmed: () => {
      usdc.refetch();
      reset({ amount: "1000" });
    },
  });

  const onValid = async (values: FaucetInput) => {
    setFormError(null);
    if (!address) {
      setFormError("Connect a wallet first.");
      return;
    }
    const parsed = parseTokenInput(values.amount, usdc.decimals);
    if (parsed.value === null) {
      setFormError(parsed.error ?? "Invalid amount");
      return;
    }
    try {
      await tx.submit({
        ...usdcContract(),
        functionName: "mint",
        args: [address, parsed.value],
      });
    } catch (error) {
      tx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <Card>
      <CardHeader title="Faucet" description="Mint test MockUSDC to fund deals." />
      <form onSubmit={handleSubmit(onValid)} noValidate className="flex items-end gap-2">
        <div className="flex-1">
          <Field label={`Amount (${usdc.symbol})`} htmlFor="faucet-amount" error={errors.amount?.message}>
            <Input id="faucet-amount" inputMode="decimal" {...register("amount")} />
          </Field>
        </div>
        <Button type="submit" loading={tx.isBusy} className="mb-4">
          Mint
        </Button>
      </form>
      {formError ? <p className="field-error">{formError}</p> : null}
    </Card>
  );
}
