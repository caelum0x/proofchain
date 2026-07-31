"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { TxLink } from "@/components/ui/TxLink";

const schema = z.object({
  rate: z.coerce.number().int("Whole number").min(0, "Cannot be negative"),
});
type FormValues = z.infer<typeof schema>;

/**
 * Set the per-epoch emission-rate cap on `EmissionsController`. Controller role
 * required; the write reverts above `MAX_EMISSION_RATE`, which the UI enforces
 * client-side too.
 */
export function SetEmissionRateForm({ maxRate, onDone }: { maxRate?: bigint; onDone?: () => void }) {
  const ref = tryContractRef("EmissionsController");
  const [formError, setFormError] = useState<string | null>(null);
  const tx = useTx({ successLabel: "Emission rate updated", onConfirmed: () => onDone?.() });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rate: 0 },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!ref) return setFormError("EmissionsController is not deployed on this network.");
    if (maxRate !== undefined && BigInt(values.rate) > maxRate) {
      return setFormError(`Rate exceeds the maximum of ${maxRate.toString()}.`);
    }
    try {
      await tx.submit({
        address: ref.address,
        abi: ref.abi,
        functionName: "setEmissionRate",
        args: [BigInt(values.rate)],
      });
    } catch (e) {
      tx.reset();
      setFormError(getErrorMessage(e));
    }
  });

  return (
    <Card>
      <CardHeader
        title="Set emission cap"
        description={maxRate !== undefined ? `Controller role required. Max ${maxRate.toString()}.` : "Controller role required."}
      />
      <form onSubmit={onSubmit} noValidate className="space-y-1">
        <Field label="New rate (units per epoch)" htmlFor="er-rate" error={errors.rate?.message}>
          <Input id="er-rate" type="number" min={0} {...register("rate")} />
        </Field>
        {formError ? <Callout tone="danger" className="mb-3">{formError}</Callout> : null}
        <Button type="submit" loading={tx.isBusy}>
          {tx.isSigning ? "Confirm in wallet…" : tx.isPending ? "Updating…" : "Set rate"}
        </Button>
        {tx.hash ? (
          <p className="mt-3 text-xs text-muted">
            Tx: <TxLink hash={tx.hash} />
          </p>
        ) : null}
      </form>
    </Card>
  );
}
