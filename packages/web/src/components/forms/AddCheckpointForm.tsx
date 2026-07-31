"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addCheckpointSchema, type AddCheckpointInput } from "@/lib/schemas";
import { hashString, normalizeBytes32 } from "@/lib/hashing";
import { provenanceContract } from "@/lib/contracts";
import { getErrorMessage } from "@/lib/errors";
import { useTx } from "@/hooks/useTx";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";

/** Append a provenance checkpoint to an existing batch. */
export function AddCheckpointForm({ defaultBatchId }: { defaultBatchId?: string }) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddCheckpointInput>({
    resolver: zodResolver(addCheckpointSchema),
    defaultValues: {
      batchId: defaultBatchId ?? "",
      location: "",
      occurredAt: "",
      dataReference: "",
    },
  });

  const tx = useTx({
    successLabel: "Checkpoint added",
    onConfirmed: () => reset(),
  });

  const onValid = async (values: AddCheckpointInput) => {
    setFormError(null);
    try {
      const batchId = normalizeBytes32(values.batchId);
      const timestamp = BigInt(Math.floor(Date.parse(values.occurredAt) / 1000));
      const dataHash = hashString(values.dataReference);
      await tx.submit({
        ...provenanceContract(),
        functionName: "addCheckpoint",
        args: [batchId, values.location.trim(), timestamp, dataHash],
      });
    } catch (error) {
      tx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Add checkpoint"
        description="Append-only. The batch must already be registered."
      />
      <form onSubmit={handleSubmit(onValid)} noValidate>
        <Field
          label="Batch id or reference"
          htmlFor="cp-batch"
          hint="Paste a 0x… batchId or type the same reference used at registration."
          error={errors.batchId?.message}
        >
          <Input id="cp-batch" placeholder="0x… or Coffee lot #A-2043" {...register("batchId")} />
        </Field>

        <Field label="Location" htmlFor="cp-location" error={errors.location?.message}>
          <Input id="cp-location" placeholder="Port of Cartagena" {...register("location")} />
        </Field>

        <Field
          label="Timestamp"
          htmlFor="cp-time"
          hint="When the event occurred."
          error={errors.occurredAt?.message}
        >
          <Input id="cp-time" type="datetime-local" {...register("occurredAt")} />
        </Field>

        <Field
          label="Data reference"
          htmlFor="cp-data"
          hint="Any evidence reference; hashed to dataHash."
          error={errors.dataReference?.message}
        >
          <Input id="cp-data" placeholder="BoL #55231" {...register("dataReference")} />
        </Field>

        {formError ? <p className="field-error mb-3">{formError}</p> : null}

        <Button type="submit" loading={tx.isBusy}>
          {tx.isSigning ? "Confirm in wallet…" : tx.isPending ? "Adding…" : "Add checkpoint"}
        </Button>

        {tx.hash ? (
          <p className="mt-3 text-xs text-muted">
            Transaction: <TxLink hash={tx.hash} />
          </p>
        ) : null}
      </form>
    </Card>
  );
}
