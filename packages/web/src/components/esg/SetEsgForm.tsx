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
import { TxLink } from "@/components/ui/TxLink";

const schema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(200, "Too long"),
  score: z.coerce.number().int("Whole number").min(0, "Min 0").max(10000, "Max 10000 bps"),
  uri: z
    .string()
    .trim()
    .min(1, "URI is required")
    .max(500, "Too long")
    .refine((v) => /^(https?|ipfs):\/\//.test(v), { message: "Must be an http(s):// or ipfs:// URI" }),
});
type FormValues = z.infer<typeof schema>;

/**
 * Publish an ESG score/attestation for a subject (batch or org id). The subject
 * may be a raw bytes32 or a human reference we keccak-hash. Requires the
 * ESGRegistry attestor role; unauthorized calls revert and are surfaced.
 */
export function SetEsgForm({ onDone }: { onDone?: () => void }) {
  const esg = tryContractRef("ESGRegistry");
  const [formError, setFormError] = useState<string | null>(null);
  const tx = useTx({ successLabel: "ESG record set", onConfirmed: () => onDone?.() });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { subject: "", score: 8000, uri: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!esg) return setFormError("ESGRegistry is not deployed on this network.");
    try {
      const subject = normalizeBytes32(values.subject);
      await tx.submit({
        address: esg.address,
        abi: esg.abi,
        functionName: "setEsg",
        args: [subject, values.score, values.uri.trim()],
      });
    } catch (e) {
      tx.reset();
      setFormError(getErrorMessage(e));
    }
  });

  return (
    <Card>
      <CardHeader title="Set ESG attestation" description="Attestor role required. Score is basis points (0–10000)." />
      <form onSubmit={onSubmit} noValidate>
        <Field label="Subject (batch/org id or reference)" htmlFor="esg-subject" error={errors.subject?.message}>
          <Input id="esg-subject" placeholder="0x… or reference" {...register("subject")} />
        </Field>
        <Field label="Score (bps)" htmlFor="esg-score" error={errors.score?.message}>
          <Input id="esg-score" type="number" min={0} max={10000} {...register("score")} />
        </Field>
        <Field label="Evidence URI" htmlFor="esg-uri" error={errors.uri?.message}>
          <Input id="esg-uri" placeholder="ipfs://… or https://…" {...register("uri")} />
        </Field>
        {formError ? <p className="field-error mb-3">{formError}</p> : null}
        <Button type="submit" loading={tx.isBusy}>
          Publish ESG record
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
