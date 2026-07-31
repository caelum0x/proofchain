"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { normalizeBytes32 } from "@/lib/hashing";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { TxLink } from "@/components/ui/TxLink";

const schema = z.object({
  batchId: z.string().trim().min(1, "Batch / shipment id is required").max(200, "Too long"),
  co2e: z.coerce.number().int("Whole grams").min(0, "Cannot be negative").max(1_000_000_000_000, "Too large"),
});
type FormValues = z.infer<typeof schema>;

/**
 * Record a measured CO₂e footprint (grams) for a batch on the
 * `SustainabilityOracle`. Keeper role required. Feeds ESG scoring and the carbon
 * offset marketplace's remaining-footprint calculation.
 */
export function PushEmissionsForm({ defaultBatchId, onDone }: { defaultBatchId?: string; onDone?: () => void }) {
  const ref = tryContractRef("SustainabilityOracle");
  const [formError, setFormError] = useState<string | null>(null);
  const tx = useTx({ successLabel: "Emissions recorded", onConfirmed: () => onDone?.() });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { batchId: defaultBatchId ?? "", co2e: 0 },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!ref) return setFormError("SustainabilityOracle is not deployed on this network.");
    try {
      const batchId = normalizeBytes32(values.batchId);
      await tx.submit({
        address: ref.address,
        abi: ref.abi,
        functionName: "pushEmissions",
        args: [batchId, BigInt(values.co2e)],
      });
    } catch (e) {
      tx.reset();
      setFormError(getErrorMessage(e));
    }
  });

  return (
    <Card>
      <CardHeader title="Record emissions" description="Keeper role required. CO₂e in grams for a batch/shipment." />
      <form onSubmit={onSubmit} noValidate className="space-y-1">
        <Field label="Batch / shipment id or reference" htmlFor="em-batch" error={errors.batchId?.message}>
          <Input id="em-batch" placeholder="0x… or Coffee lot #A-2043" {...register("batchId")} />
        </Field>
        <Field label="CO₂e (grams)" htmlFor="em-co2e" error={errors.co2e?.message}>
          <Input id="em-co2e" type="number" min={0} {...register("co2e")} />
        </Field>
        {formError ? <Callout tone="danger" className="mb-3">{formError}</Callout> : null}
        <Button type="submit" loading={tx.isBusy}>
          {tx.isSigning ? "Confirm in wallet…" : tx.isPending ? "Recording…" : "Record emissions"}
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
