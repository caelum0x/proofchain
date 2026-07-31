"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { normalizeBytes32, hashString } from "@/lib/hashing";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { TxLink } from "@/components/ui/TxLink";
import { toCentidegrees } from "./temp";

const schema = z.object({
  batchId: z.string().trim().min(1, "Shipment / container id is required").max(200, "Too long"),
  location: z.string().trim().min(1, "Location is required").max(120, "Too long"),
  tempC: z.coerce.number().min(-90, "Too low").max(90, "Too high"),
  dataReference: z.string().trim().max(200, "Too long").optional().default(""),
});
type FormValues = z.infer<typeof schema>;

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Push an IoT/location checkpoint (with a cold-chain temperature reading) to the
 * `CheckpointOracle`. Requires the keeper role; unauthorized writes revert and
 * are surfaced. Temperature is captured in °C and stored on-chain as centidegrees.
 */
export function PushCheckpointForm({ defaultBatchId, onDone }: { defaultBatchId?: string; onDone?: () => void }) {
  const ref = tryContractRef("CheckpointOracle");
  const [formError, setFormError] = useState<string | null>(null);
  const tx = useTx({ successLabel: "Checkpoint recorded", onConfirmed: () => onDone?.() });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { batchId: defaultBatchId ?? "", location: "", tempC: 4, dataReference: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!ref) return setFormError("CheckpointOracle is not deployed on this network.");
    try {
      const batchId = normalizeBytes32(values.batchId);
      const dataHash = values.dataReference ? hashString(values.dataReference) : ZERO_HASH;
      await tx.submit({
        address: ref.address,
        abi: ref.abi,
        functionName: "pushCheckpoint",
        args: [batchId, values.location.trim(), toCentidegrees(values.tempC), dataHash],
      });
    } catch (e) {
      tx.reset();
      setFormError(getErrorMessage(e));
    }
  });

  return (
    <Card>
      <CardHeader title="Push checkpoint" description="Keeper role required. Records location + temperature for a shipment." />
      <form onSubmit={onSubmit} noValidate className="space-y-1">
        <Field label="Shipment / container id or reference" htmlFor="cp-batch" error={errors.batchId?.message}>
          <Input id="cp-batch" placeholder="0x… or Coffee lot #A-2043" {...register("batchId")} />
        </Field>
        <Field label="Location" htmlFor="cp-loc" error={errors.location?.message}>
          <Input id="cp-loc" placeholder="Port of Cartagena" {...register("location")} />
        </Field>
        <Field label="Temperature (°C)" htmlFor="cp-temp" error={errors.tempC?.message}>
          <Input id="cp-temp" type="number" step="0.1" {...register("tempC")} />
        </Field>
        <Field label="Evidence reference (optional)" htmlFor="cp-data" hint="Any reference; hashed to dataHash." error={errors.dataReference?.message}>
          <Input id="cp-data" placeholder="BoL #55231" {...register("dataReference")} />
        </Field>
        {formError ? <Callout tone="danger" className="mb-3">{formError}</Callout> : null}
        <Button type="submit" loading={tx.isBusy}>
          {tx.isSigning ? "Confirm in wallet…" : tx.isPending ? "Recording…" : "Push checkpoint"}
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
