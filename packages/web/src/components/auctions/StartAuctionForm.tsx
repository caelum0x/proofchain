"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getAddress, isAddress, type Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";

// Minimal ERC721 operator-approval surface, valid for any compliant NFT.
const erc721Abi = [
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
] as const;

const schema = z.object({
  nft: z.string().trim().refine((v): boolean => isAddress(v), { message: "Enter a valid NFT contract" }),
  tokenId: z.string().trim().regex(/^\d+$/, "Whole number id"),
  paymentToken: z.string().trim().refine((v): boolean => isAddress(v), { message: "Enter a valid token address" }),
  reservePrice: z.string().trim().regex(/^\d+$/, "Reserve in base units"),
  duration: z.string().trim().regex(/^\d+$/, "Seconds").refine((v) => Number(v) > 0, { message: "Must be > 0" }),
});
type FormValues = z.infer<typeof schema>;

/**
 * Start an English auction. The AuctionHouse escrows the NFT via
 * `safeTransferFrom`, so the seller must first grant operator approval on the NFT
 * contract; the form reads current approval and shows the approve step when needed.
 */
export function StartAuctionForm({ onDone }: { onDone?: () => void }) {
  const auctionHouse = tryContractRef("AuctionHouse");
  const usdc = tryContractRef("MockUSDC");
  const { address: account } = useAccount();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nft: "",
      tokenId: "0",
      paymentToken: usdc?.address ?? "",
      reservePrice: "0",
      duration: "86400",
    },
  });

  const nftInput = watch("nft");
  const nftAddr = isAddress(nftInput) ? (getAddress(nftInput) as Address) : undefined;

  const approvalQuery = useReadContract({
    address: nftAddr,
    abi: erc721Abi,
    functionName: "isApprovedForAll",
    args: account && auctionHouse ? [account, auctionHouse.address] : undefined,
    query: { enabled: Boolean(nftAddr && account && auctionHouse) },
  });
  const approved = Boolean(approvalQuery.data);

  const approveTx = useTx({ successLabel: "Auction house approved", onConfirmed: () => approvalQuery.refetch() });
  const startTx = useTx({ successLabel: "Auction started", onConfirmed: () => onDone?.() });

  const onApprove = async () => {
    setFormError(null);
    if (!nftAddr || !auctionHouse) return setFormError("Enter the NFT contract first.");
    try {
      await approveTx.submit({
        address: nftAddr,
        abi: erc721Abi,
        functionName: "setApprovalForAll",
        args: [auctionHouse.address, true],
      });
    } catch (e) {
      approveTx.reset();
      setFormError(getErrorMessage(e));
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!auctionHouse) return setFormError("AuctionHouse is not deployed on this network.");
    try {
      await startTx.submit({
        address: auctionHouse.address,
        abi: auctionHouse.abi,
        functionName: "startAuction",
        args: [
          getAddress(values.nft),
          BigInt(values.tokenId),
          getAddress(values.paymentToken),
          BigInt(values.reservePrice),
          BigInt(values.duration),
        ],
      });
    } catch (e) {
      startTx.reset();
      setFormError(getErrorMessage(e));
    }
  });

  return (
    <Card>
      <CardHeader title="Start an auction" description="List an NFT you own for an English auction." />
      <form onSubmit={onSubmit} noValidate>
        <Field label="NFT contract" htmlFor="auc-nft" error={errors.nft?.message}>
          <Input id="auc-nft" placeholder="0x…" {...register("nft")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Token id" htmlFor="auc-token" error={errors.tokenId?.message}>
            <Input id="auc-token" inputMode="numeric" {...register("tokenId")} />
          </Field>
          <Field label="Duration (s)" htmlFor="auc-duration" error={errors.duration?.message}>
            <Input id="auc-duration" inputMode="numeric" {...register("duration")} />
          </Field>
        </div>
        <Field label="Payment token" htmlFor="auc-payment" error={errors.paymentToken?.message}>
          <Input id="auc-payment" placeholder="0x…" {...register("paymentToken")} />
        </Field>
        <Field label="Reserve price (base units)" htmlFor="auc-reserve" error={errors.reservePrice?.message}>
          <Input id="auc-reserve" inputMode="numeric" {...register("reservePrice")} />
        </Field>
        {formError ? <p className="field-error mb-3">{formError}</p> : null}
        <div className="flex flex-wrap gap-2">
          {nftAddr && !approved ? (
            <Button type="button" variant="primary" onClick={onApprove} loading={approveTx.isBusy}>
              Approve NFT
            </Button>
          ) : null}
          <Button type="submit" loading={startTx.isBusy} disabled={Boolean(nftAddr) && !approved}>
            Start auction
          </Button>
        </div>
        {approveTx.hash ? (
          <p className="mt-3 text-xs text-muted">
            Approve tx: <TxLink hash={approveTx.hash} />
          </p>
        ) : null}
        {startTx.hash ? (
          <p className="mt-1 text-xs text-muted">
            Start tx: <TxLink hash={startTx.hash} />
          </p>
        ) : null}
      </form>
    </Card>
  );
}
