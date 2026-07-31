"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getAddress, isAddress } from "viem";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { getErrorMessage } from "@/lib/errors";
import { OrderSide } from "@/hooks/useMarketplace";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";

const schema = z.object({
  side: z.enum(["Buy", "Sell"]),
  asset: z.string().trim().refine((v): boolean => isAddress(v), { message: "Enter a valid asset address" }),
  assetId: z.string().trim().regex(/^\d+$/, "Whole number id"),
  paymentToken: z.string().trim().refine((v): boolean => isAddress(v), { message: "Enter a valid token address" }),
  price: z.string().trim().regex(/^\d+$/, "Price in base units"),
  quantity: z.string().trim().regex(/^\d+$/, "Whole number quantity"),
});
type FormValues = z.infer<typeof schema>;

/** Place a limit order on the OrderBook for a fungible tokenized asset. */
export function PlaceOrderForm({ onDone }: { onDone?: () => void }) {
  const book = tryContractRef("OrderBook");
  const [formError, setFormError] = useState<string | null>(null);
  const tx = useTx({ successLabel: "Order placed", onConfirmed: () => onDone?.() });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { side: "Buy", asset: "", assetId: "0", paymentToken: "", price: "", quantity: "1" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!book) return setFormError("OrderBook is not deployed on this network.");
    try {
      await tx.submit({
        address: book.address,
        abi: book.abi,
        functionName: "placeOrder",
        args: [
          values.side === "Buy" ? OrderSide.Buy : OrderSide.Sell,
          getAddress(values.asset),
          BigInt(values.assetId),
          getAddress(values.paymentToken),
          BigInt(values.price),
          BigInt(values.quantity),
        ],
      });
    } catch (e) {
      tx.reset();
      setFormError(getErrorMessage(e));
    }
  });

  return (
    <Card>
      <CardHeader title="Place limit order" description="Post a buy or sell order for a tokenized asset." />
      <form onSubmit={onSubmit} noValidate>
        <Field label="Side" htmlFor="order-side" error={errors.side?.message}>
          <select id="order-side" className="input" {...register("side")}>
            <option value="Buy">Buy</option>
            <option value="Sell">Sell</option>
          </select>
        </Field>
        <Field label="Asset contract" htmlFor="order-asset" error={errors.asset?.message}>
          <Input id="order-asset" placeholder="0x…" {...register("asset")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Asset id" htmlFor="order-assetid" error={errors.assetId?.message}>
            <Input id="order-assetid" inputMode="numeric" {...register("assetId")} />
          </Field>
          <Field label="Quantity" htmlFor="order-qty" error={errors.quantity?.message}>
            <Input id="order-qty" inputMode="numeric" {...register("quantity")} />
          </Field>
        </div>
        <Field label="Payment token" htmlFor="order-token" error={errors.paymentToken?.message}>
          <Input id="order-token" placeholder="0x…" {...register("paymentToken")} />
        </Field>
        <Field label="Price (base units)" htmlFor="order-price" error={errors.price?.message}>
          <Input id="order-price" inputMode="numeric" placeholder="1000000" {...register("price")} />
        </Field>
        {formError ? <p className="field-error mb-3">{formError}</p> : null}
        <Button type="submit" loading={tx.isBusy}>
          Place order
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
