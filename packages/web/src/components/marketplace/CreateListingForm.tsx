"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getAddress, isAddress, type Address } from "viem";
import { useErc20 } from "@/hooks/useErc20";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { parseTokenInput } from "@/lib/amount";
import { getErrorMessage } from "@/lib/errors";
import { AssetKind } from "@/hooks/useMarketplace";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";

const schema = z.object({
  kind: z.enum(["Receivable", "ERC721", "ERC1155"]),
  asset: z.string().trim().refine((v): boolean => isAddress(v), { message: "Enter a valid asset address" }),
  assetId: z.string().trim().regex(/^\d+$/, "Whole number id"),
  amount: z.string().trim().regex(/^\d+$/, "Whole number amount"),
  paymentToken: z.string().trim().refine((v): boolean => isAddress(v), { message: "Enter a valid token address" }),
  price: z.string().trim().min(1, "Price is required"),
});
type FormValues = z.infer<typeof schema>;

const KIND_VALUE: Record<FormValues["kind"], number> = {
  Receivable: AssetKind.Receivable,
  ERC721: AssetKind.ERC721,
  ERC1155: AssetKind.ERC1155,
};

/**
 * Create a marketplace listing. The ListingRegistry records the offer (no asset
 * escrow); price is entered in the payment token's own decimals, resolved live
 * from the entered token address.
 */
export function CreateListingForm({ onDone }: { onDone?: () => void }) {
  const registry = tryContractRef("ListingRegistry");
  const [formError, setFormError] = useState<string | null>(null);
  const tx = useTx({ successLabel: "Listing created", onConfirmed: () => onDone?.() });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { kind: "ERC721", asset: "", assetId: "0", amount: "1", paymentToken: "", price: "" },
  });

  const paymentToken = watch("paymentToken");
  const tokenAddr = isAddress(paymentToken) ? (getAddress(paymentToken) as Address) : undefined;
  const erc20 = useErc20(tokenAddr, undefined);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!registry) return setFormError("ListingRegistry is not deployed on this network.");
    const parsedPrice = parseTokenInput(values.price, erc20.decimals);
    if (parsedPrice.value === null) return setFormError(parsedPrice.error ?? "Invalid price");
    try {
      await tx.submit({
        address: registry.address,
        abi: registry.abi,
        functionName: "createListing",
        args: [
          KIND_VALUE[values.kind],
          getAddress(values.asset),
          BigInt(values.assetId),
          BigInt(values.amount),
          getAddress(values.paymentToken),
          parsedPrice.value,
        ],
      });
    } catch (e) {
      tx.reset();
      setFormError(getErrorMessage(e));
    }
  });

  return (
    <Card>
      <CardHeader title="Create listing" description="List a receivable, NFT, or credit for sale." />
      <form onSubmit={onSubmit} noValidate>
        <Field label="Asset kind" htmlFor="listing-kind" error={errors.kind?.message}>
          <select id="listing-kind" className="input" {...register("kind")}>
            <option value="Receivable">Receivable</option>
            <option value="ERC721">ERC721 (NFT)</option>
            <option value="ERC1155">ERC1155</option>
          </select>
        </Field>
        <Field label="Asset contract" htmlFor="listing-asset" error={errors.asset?.message}>
          <Input id="listing-asset" placeholder="0x…" {...register("asset")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Asset id" htmlFor="listing-assetid" error={errors.assetId?.message}>
            <Input id="listing-assetid" inputMode="numeric" {...register("assetId")} />
          </Field>
          <Field label="Amount" htmlFor="listing-amount" error={errors.amount?.message}>
            <Input id="listing-amount" inputMode="numeric" {...register("amount")} />
          </Field>
        </div>
        <Field label="Payment token" htmlFor="listing-token" error={errors.paymentToken?.message}>
          <Input id="listing-token" placeholder="0x…" {...register("paymentToken")} />
        </Field>
        <Field
          label={`Price (${erc20.symbol})`}
          htmlFor="listing-price"
          error={errors.price?.message}
          hint={tokenAddr ? `Token has ${erc20.decimals} decimals` : "Enter the payment token first"}
        >
          <Input id="listing-price" inputMode="decimal" placeholder="1000" {...register("price")} />
        </Field>
        {formError ? <p className="field-error mb-3">{formError}</p> : null}
        <Button type="submit" loading={tx.isBusy}>
          Create listing
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
