"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getAddress, isAddress, type Hex } from "viem";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";
import { useTx } from "@/hooks/useTx";
import { contractRef } from "@/lib/contracts";
import { parseTokenInput } from "@/lib/amount";
import { getResolvedAddress } from "@/lib/shared";
import { getErrorMessage } from "@/lib/errors";

const schema = z.object({
  faceValue: z
    .string()
    .trim()
    .min(1, "Face value is required")
    .regex(/^\d+(\.\d+)?$/, "Enter a positive number")
    .refine((v) => Number(v) > 0, "Must be greater than zero"),
  dueDate: z
    .string()
    .trim()
    .min(1, "Due date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
    .refine((v) => Date.parse(v) > Date.now(), "Due date must be in the future"),
  obligor: z.string().trim().refine((v): boolean => isAddress(v), "Enter a valid 0x… address"),
});
type FormInput = z.infer<typeof schema>;

interface RegisterReceivableFormProps {
  readonly batchId: Hex;
  readonly decimals: number;
  readonly symbol: string;
  readonly onRegistered?: () => void;
}

/**
 * Register a receivable's terms (face value, due date, obligor) so it can be
 * financed. The settlement token defaults to the platform stablecoin.
 */
export function RegisterReceivableForm({ batchId, decimals, symbol, onRegistered }: RegisterReceivableFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const token = getResolvedAddress("MockUSDC");
  const registerTx = useTx({ successLabel: "Receivable terms registered", onConfirmed: onRegistered });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput>({ resolver: zodResolver(schema), defaultValues: { faceValue: "", dueDate: "", obligor: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const parsed = parseTokenInput(values.faceValue, decimals);
    if (parsed.value === null) {
      setFormError(parsed.error ?? "Invalid face value");
      return;
    }
    if (!token) {
      setFormError("Settlement token is not configured on this network.");
      return;
    }
    const due = BigInt(Math.floor(Date.parse(values.dueDate) / 1000));
    try {
      await registerTx.submit({
        ...contractRef("ReceivableRegistry"),
        functionName: "register",
        args: [batchId, parsed.value, due, getAddress(values.obligor), token],
      });
    } catch (error) {
      registerTx.reset();
      setFormError(getErrorMessage(error));
    }
  });

  return (
    <Card>
      <CardHeader title="Register receivable terms" description="Define the face value, maturity, and obligor." />
      <form noValidate onSubmit={onSubmit}>
        <Field label={`Face value (${symbol})`} htmlFor="rcv-face" error={errors.faceValue?.message}>
          <Input id="rcv-face" inputMode="decimal" placeholder="1000" {...register("faceValue")} />
        </Field>
        <Field label="Due date" htmlFor="rcv-due" error={errors.dueDate?.message}>
          <Input id="rcv-due" type="datetime-local" {...register("dueDate")} />
        </Field>
        <Field label="Obligor address" htmlFor="rcv-obligor" error={errors.obligor?.message}>
          <Input id="rcv-obligor" placeholder="0x…" {...register("obligor")} />
        </Field>
        {formError ? <p className="field-error mb-3">{formError}</p> : null}
        <Button type="submit" loading={registerTx.isBusy}>
          {registerTx.isBusy ? "Registering…" : "Register terms"}
        </Button>
        {registerTx.hash ? (
          <p className="mt-3 text-xs text-muted">Register tx: <TxLink hash={registerTx.hash} /></p>
        ) : null}
      </form>
    </Card>
  );
}
