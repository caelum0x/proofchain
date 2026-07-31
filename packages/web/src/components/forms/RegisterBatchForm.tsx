"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Hex } from "viem";
import { registerBatchSchema, type RegisterBatchInput } from "@/lib/schemas";
import { hashString } from "@/lib/hashing";
import { provenanceContract } from "@/lib/contracts";
import { getErrorMessage } from "@/lib/errors";
import { useTx } from "@/hooks/useTx";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { HashPreview } from "@/components/HashPreview";
import { TxLink } from "@/components/ui/TxLink";

/**
 * Register a new provenance batch. The user types friendly labels; we derive
 * the on-chain bytes32 batchId and originHash via keccak256 and show them for
 * transparency and reuse in later steps.
 */
export function RegisterBatchForm({ onRegistered }: { onRegistered?: (batchId: Hex) => void }) {
  const [lastBatchId, setLastBatchId] = useState<Hex | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<RegisterBatchInput>({
    resolver: zodResolver(registerBatchSchema),
    defaultValues: { reference: "", origin: "", metadataURI: "" },
  });

  const tx = useTx({
    successLabel: "Batch registered",
    onConfirmed: (hash) => {
      if (lastBatchId) onRegistered?.(lastBatchId);
      reset();
      void hash;
    },
  });

  const reference = watch("reference");
  const origin = watch("origin");

  const onValid = async (values: RegisterBatchInput) => {
    setFormError(null);
    try {
      const batchId = hashString(values.reference);
      const originHash = hashString(values.origin);
      setLastBatchId(batchId);
      await tx.submit({
        ...provenanceContract(),
        functionName: "registerBatch",
        args: [batchId, originHash, values.metadataURI.trim()],
      });
    } catch (error) {
      tx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Register batch"
        description="Create an append-only provenance record. Requires REGISTRAR_ROLE."
      />
      <form onSubmit={handleSubmit(onValid)} noValidate>
        <Field
          label="Batch reference"
          htmlFor="reference"
          hint="A human label or SKU. Hashed to the on-chain batchId."
          error={errors.reference?.message}
        >
          <Input id="reference" placeholder="Coffee lot #A-2043" {...register("reference")} />
        </Field>
        {reference ? <HashPreview label="batchId" value={hashString(reference)} /> : null}

        <Field
          label="Origin descriptor"
          htmlFor="origin"
          hint="Origin/source info. Hashed to originHash."
          error={errors.origin?.message}
        >
          <Input id="origin" placeholder="Farm co-op, Huila, Colombia" {...register("origin")} />
        </Field>
        {origin ? <HashPreview label="originHash" value={hashString(origin)} /> : null}

        <Field
          label="Metadata URI"
          htmlFor="metadataURI"
          hint="http(s):// or ipfs:// link to batch metadata."
          error={errors.metadataURI?.message}
        >
          <Input
            id="metadataURI"
            placeholder="ipfs://… or https://…"
            {...register("metadataURI")}
          />
        </Field>

        {formError ? <p className="field-error mb-3">{formError}</p> : null}

        <Button type="submit" loading={tx.isBusy}>
          {tx.isSigning ? "Confirm in wallet…" : tx.isPending ? "Registering…" : "Register batch"}
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
