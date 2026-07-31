"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";
import { useTx } from "@/hooks/useTx";
import { contractRef } from "@/lib/contracts";
import { normalizeBytes32 } from "@/lib/hashing";
import { parseTokenInput } from "@/lib/amount";
import { getErrorMessage } from "@/lib/errors";

const schema = z.object({
  batchId: z.string().trim().min(1, "Batch id or reference is required").max(200, "Too long"),
  askAmount: z
    .string()
    .trim()
    .min(1, "Ask amount is required")
    .regex(/^\d+(\.\d+)?$/, "Enter a positive number")
    .refine((v) => Number(v) > 0, "Amount must be greater than zero"),
});
type FormInput = z.infer<typeof schema>;

interface ListReceivableFormProps {
  readonly decimals: number;
  readonly symbol: string;
  readonly onListed?: () => void;
}

/**
 * Supplier lists an attested receivable for financing at a discount. The
 * contract requires the batch to be attested; a clear error surfaces otherwise.
 */
export function ListReceivableForm({ decimals, symbol, onListed }: ListReceivableFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const listTx = useTx({ successLabel: "Receivable listed", onConfirmed: onListed });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput>({ resolver: zodResolver(schema), defaultValues: { batchId: "", askAmount: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const parsed = parseTokenInput(values.askAmount, decimals);
    if (parsed.value === null) {
      setFormError(parsed.error ?? "Invalid amount");
      return;
    }
    try {
      const batchId = normalizeBytes32(values.batchId);
      await listTx.submit({ ...contractRef("InvoiceFinancing"), functionName: "list", args: [batchId, parsed.value] });
      reset();
    } catch (error) {
      listTx.reset();
      setFormError(getErrorMessage(error));
    }
  });

  return (
    <Card>
      <CardHeader
        title="List a receivable"
        description="Offer an attested receivable for financing. Lenders advance your cash now."
      />
      <form noValidate onSubmit={onSubmit}>
        <Field label="Batch id or reference" htmlFor="list-batch" error={errors.batchId?.message}>
          <Input id="list-batch" placeholder="0x… or reference" {...register("batchId")} />
        </Field>
        <Field label={`Ask amount (${symbol})`} htmlFor="list-amount" error={errors.askAmount?.message}>
          <Input id="list-amount" inputMode="decimal" placeholder="1000" {...register("askAmount")} />
        </Field>
        {formError ? <p className="field-error mb-3">{formError}</p> : null}
        <Button type="submit" loading={listTx.isBusy}>
          {listTx.isSigning ? "Confirm in wallet…" : listTx.isPending ? "Listing…" : "List receivable"}
        </Button>
        {listTx.hash ? (
          <p className="mt-3 text-xs text-muted">List tx: <TxLink hash={listTx.hash} /></p>
        ) : null}
      </form>
    </Card>
  );
}
