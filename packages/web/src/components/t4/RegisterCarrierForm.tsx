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
  name: z.string().trim().min(1, "Carrier name is required").max(120, "Too long"),
  uri: z
    .string()
    .trim()
    .min(1, "Profile URI is required")
    .max(500, "Too long")
    .refine((v) => /^(https?|ipfs):\/\//.test(v), "Must be an http(s):// or ipfs:// URI"),
});
type FormValues = z.infer<typeof schema>;

/**
 * Register (or update) the connected account as a logistics carrier in
 * `CarrierRegistry`. Registered carriers are the actors authorised to push
 * provenance/cold-chain checkpoints.
 */
export function RegisterCarrierForm({ isRegistered, onDone }: { isRegistered?: boolean; onDone?: () => void }) {
  const ref = tryContractRef("CarrierRegistry");
  const [formError, setFormError] = useState<string | null>(null);
  const tx = useTx({ successLabel: isRegistered ? "Carrier updated" : "Carrier registered", onConfirmed: () => onDone?.() });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", uri: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!ref) return setFormError("CarrierRegistry is not deployed on this network.");
    try {
      await tx.submit({
        address: ref.address,
        abi: ref.abi,
        functionName: isRegistered ? "updateCarrier" : "registerCarrier",
        args: [values.name.trim(), values.uri.trim()],
      });
    } catch (e) {
      tx.reset();
      setFormError(getErrorMessage(e));
    }
  });

  return (
    <Card>
      <CardHeader
        title={isRegistered ? "Update carrier profile" : "Register as carrier"}
        description="Carriers transport shipments and push cold-chain checkpoints."
      />
      <form onSubmit={onSubmit} noValidate className="space-y-1">
        <Field label="Carrier name" htmlFor="ca-name" error={errors.name?.message}>
          <Input id="ca-name" placeholder="Nordic Reefer Lines" {...register("name")} />
        </Field>
        <Field label="Profile URI" htmlFor="ca-uri" hint="Public profile / metadata document." error={errors.uri?.message}>
          <Input id="ca-uri" placeholder="ipfs://… or https://…" {...register("uri")} />
        </Field>
        {formError ? <Callout tone="danger" className="mb-3">{formError}</Callout> : null}
        <Button type="submit" loading={tx.isBusy}>
          {tx.isSigning ? "Confirm in wallet…" : tx.isPending ? "Submitting…" : isRegistered ? "Update profile" : "Register carrier"}
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
