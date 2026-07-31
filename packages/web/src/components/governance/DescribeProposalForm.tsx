"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { getErrorMessage } from "@/lib/errors";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";

const schema = z.object({
  uri: z
    .string()
    .trim()
    .min(1, "Metadata URI is required")
    .max(500, "Too long")
    .refine((v) => /^(https?|ipfs):\/\//.test(v), { message: "Must be an http(s):// or ipfs:// URI" }),
});
type FormValues = z.infer<typeof schema>;

/**
 * Attach a human-readable metadata URI to a proposal via ProposalRegistry.describe.
 * Each proposal id can only be described once (enforced on-chain).
 */
export function DescribeProposalForm({ proposalId, onDone }: { proposalId: string; onDone?: () => void }) {
  const registry = tryContractRef("ProposalRegistry");
  const [formError, setFormError] = useState<string | null>(null);
  const tx = useTx({ successLabel: "Proposal described", onConfirmed: () => onDone?.() });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { uri: "" } });

  if (!registry) return null;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await tx.submit({
        address: registry.address,
        abi: registry.abi,
        functionName: "describe",
        args: [BigInt(proposalId), values.uri.trim()],
      });
    } catch (e) {
      tx.reset();
      setFormError(getErrorMessage(e));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <Field label="Metadata URI" htmlFor="describe-uri" error={errors.uri?.message}>
        <Input id="describe-uri" placeholder="ipfs://… or https://…" {...register("uri")} />
      </Field>
      {formError ? <p className="field-error mb-3">{formError}</p> : null}
      <Button type="submit" loading={tx.isBusy}>
        Attach metadata
      </Button>
      {tx.hash ? (
        <p className="mt-3 text-xs text-muted">
          Tx: <TxLink hash={tx.hash} />
        </p>
      ) : null}
    </form>
  );
}
