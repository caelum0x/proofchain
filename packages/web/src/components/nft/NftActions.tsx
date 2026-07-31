"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getAddress, isAddress, type Address } from "viem";
import { useAccount } from "wagmi";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { getErrorMessage } from "@/lib/errors";
import type { NftCollectionName } from "@/hooks/useNfts";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";

const transferSchema = z.object({
  to: z
    .string()
    .trim()
    .refine((v): boolean => isAddress(v), { message: "Enter a valid 0x… address" }),
});
type TransferValues = z.infer<typeof transferSchema>;

/**
 * Owner actions for a single token: transfer to another address, and (for
 * warehouse receipts) redeem/burn the receipt. Every action is gated on the
 * connected account being the current owner; the contract re-enforces this.
 */
export function NftActions({
  collection,
  tokenId,
  owner,
  redeemable,
  onDone,
}: {
  collection: NftCollectionName;
  tokenId: bigint;
  owner: Address | undefined;
  redeemable: boolean;
  onDone: () => void;
}) {
  const { address: account } = useAccount();
  const ref = tryContractRef(collection);
  const [formError, setFormError] = useState<string | null>(null);
  const transferTx = useTx({ successLabel: "Token transferred", onConfirmed: onDone });
  const redeemTx = useTx({ successLabel: "Receipt redeemed", onConfirmed: onDone });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TransferValues>({ resolver: zodResolver(transferSchema), defaultValues: { to: "" } });

  const isOwner = Boolean(account && owner && account.toLowerCase() === owner.toLowerCase());

  if (!ref) return <p className="text-sm text-muted">This collection is not deployed on the network.</p>;

  if (!isOwner) {
    return <p className="text-sm text-muted">Connect the owning wallet to transfer or redeem this token.</p>;
  }

  const onTransfer = handleSubmit(async (values) => {
    setFormError(null);
    if (!account) return;
    try {
      await transferTx.submit({
        address: ref.address,
        abi: ref.abi,
        functionName: "safeTransferFrom",
        args: [account, getAddress(values.to), tokenId],
      });
    } catch (e) {
      transferTx.reset();
      setFormError(getErrorMessage(e));
    }
  });

  const onRedeem = async () => {
    setFormError(null);
    try {
      await redeemTx.submit({ address: ref.address, abi: ref.abi, functionName: "redeem", args: [tokenId] });
    } catch (e) {
      redeemTx.reset();
      setFormError(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={onTransfer} noValidate className="space-y-2">
        <Field label="Transfer to" htmlFor="nft-to" error={errors.to?.message}>
          <Input id="nft-to" placeholder="0x…" {...register("to")} />
        </Field>
        <Button type="submit" loading={transferTx.isBusy}>
          Transfer token
        </Button>
      </form>

      {redeemable ? (
        <div>
          <Button variant="danger" onClick={onRedeem} loading={redeemTx.isBusy}>
            Redeem receipt
          </Button>
          <p className="mt-1 text-xs text-muted">Burns the receipt and releases the stored-goods claim.</p>
        </div>
      ) : null}

      {formError ? <p className="field-error">{formError}</p> : null}
      {transferTx.hash ? (
        <p className="text-xs text-muted">
          Transfer tx: <TxLink hash={transferTx.hash} />
        </p>
      ) : null}
      {redeemTx.hash ? (
        <p className="text-xs text-muted">
          Redeem tx: <TxLink hash={redeemTx.hash} />
        </p>
      ) : null}
    </div>
  );
}
