"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";
import { useTx } from "@/hooks/useTx";
import { contractRef } from "@/lib/contracts";
import { isBytes32 } from "@/lib/hashing";
import { parseTokenInput } from "@/lib/amount";
import { getErrorMessage } from "@/lib/errors";

const schema = z.object({
  policyId: z.string().trim().refine((v): boolean => isBytes32(v), "Policy id must be a 0x… 32-byte hex value"),
  amount: z
    .string()
    .trim()
    .min(1, "Amount is required")
    .regex(/^\d+(\.\d+)?$/, "Enter a positive number")
    .refine((v) => Number(v) > 0, "Must be greater than zero"),
});
type FormInput = z.infer<typeof schema>;

interface FileClaimFormProps {
  readonly decimals: number;
  readonly symbol: string;
  readonly defaultPolicyId?: string;
  readonly onFiled?: () => void;
}

/** File an insurance claim against a policy for a loss amount. */
export function FileClaimForm({ decimals, symbol, defaultPolicyId = "", onFiled }: FileClaimFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const fileTx = useTx({ successLabel: "Claim filed", onConfirmed: onFiled });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { policyId: defaultPolicyId, amount: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const parsed = parseTokenInput(values.amount, decimals);
    if (parsed.value === null) {
      setFormError(parsed.error ?? "Invalid amount");
      return;
    }
    try {
      await fileTx.submit({
        ...contractRef("ClaimsProcessor"),
        functionName: "fileClaim",
        args: [values.policyId as `0x${string}`, parsed.value],
      });
      reset();
    } catch (error) {
      fileTx.reset();
      setFormError(getErrorMessage(error));
    }
  });

  return (
    <Card>
      <CardHeader title="File a claim" description="Claim a loss against one of your policies." />
      <form noValidate onSubmit={onSubmit}>
        <Field label="Policy id" htmlFor="claim-policy" error={errors.policyId?.message}>
          <Input id="claim-policy" placeholder="0x… (32 bytes)" {...register("policyId")} />
        </Field>
        <Field label={`Claim amount (${symbol})`} htmlFor="claim-amount" error={errors.amount?.message}>
          <Input id="claim-amount" inputMode="decimal" placeholder="5000" {...register("amount")} />
        </Field>
        {formError ? <p className="field-error mb-3">{formError}</p> : null}
        <Button type="submit" loading={fileTx.isBusy}>
          {fileTx.isBusy ? "Filing…" : "File claim"}
        </Button>
        {fileTx.hash ? <p className="mt-3 text-xs text-muted">File tx: <TxLink hash={fileTx.hash} /></p> : null}
      </form>
    </Card>
  );
}
