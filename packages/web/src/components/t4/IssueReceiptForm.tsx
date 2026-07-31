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
  batchId: z.string().trim().min(1, "Batch id is required").max(200, "Too long"),
  to: z.string().trim().refine((v) => /^0x[a-fA-F0-9]{40}$/.test(v), "Enter a valid 0x address"),
  quantity: z.coerce.number().int("Whole units").min(1, "Must be at least 1").max(1_000_000_000, "Too large"),
  location: z.string().trim().min(1, "Warehouse location is required").max(120, "Too long"),
});
type FormValues = z.infer<typeof schema>;

/**
 * Issue a tokenized `WarehouseReceipt` (ERC-721) against a stored batch. Issuer
 * role required; the receipt is minted to the holder and can later be redeemed.
 */
export function IssueReceiptForm({ onDone }: { onDone?: () => void }) {
  const ref = tryContractRef("WarehouseReceipt");
  const [formError, setFormError] = useState<string | null>(null);
  const tx = useTx({ successLabel: "Receipt issued", onConfirmed: () => onDone?.() });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { batchId: "", to: "", quantity: 1, location: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!ref) return setFormError("WarehouseReceipt is not deployed on this network.");
    try {
      const batchId = normalizeBytes32(values.batchId);
      await tx.submit({
        address: ref.address,
        abi: ref.abi,
        functionName: "issue",
        args: [batchId, values.to as `0x${string}`, BigInt(values.quantity), values.location.trim()],
      });
    } catch (e) {
      tx.reset();
      setFormError(getErrorMessage(e));
    }
  });

  return (
    <Card>
      <CardHeader title="Issue warehouse receipt" description="Issuer role required. Mints an ERC-721 receipt to a holder." />
      <form onSubmit={onSubmit} noValidate className="space-y-1">
        <Field label="Batch id or reference" htmlFor="wr-batch" error={errors.batchId?.message}>
          <Input id="wr-batch" placeholder="0x… or Grain lot #221" {...register("batchId")} />
        </Field>
        <Field label="Holder address" htmlFor="wr-to" error={errors.to?.message}>
          <Input id="wr-to" placeholder="0x…" {...register("to")} />
        </Field>
        <Field label="Quantity" htmlFor="wr-qty" error={errors.quantity?.message}>
          <Input id="wr-qty" type="number" min={1} {...register("quantity")} />
        </Field>
        <Field label="Warehouse location" htmlFor="wr-loc" error={errors.location?.message}>
          <Input id="wr-loc" placeholder="Rotterdam DC-4" {...register("location")} />
        </Field>
        {formError ? <Callout tone="danger" className="mb-3">{formError}</Callout> : null}
        <Button type="submit" loading={tx.isBusy}>
          {tx.isSigning ? "Confirm in wallet…" : tx.isPending ? "Issuing…" : "Issue receipt"}
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
