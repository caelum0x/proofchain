"use client";

import { useState } from "react";
import { useAuction, AuctionState, AUCTION_STATE_LABEL } from "@/hooks/useAuctions";
import { useErc20 } from "@/hooks/useErc20";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { parseTokenInput } from "@/lib/amount";
import { formatTimestamp, formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { AddressLink, TxLink } from "@/components/ui/TxLink";
import type { ToneName } from "@/lib/format";

const STATE_TONE: Record<number, ToneName> = { 0: "neutral", 1: "brand", 2: "success", 3: "neutral" };

/**
 * A single auction card with live state, a bid form (approve payment token to
 * BidManager, then bid), and a permissionless settle action once the clock ends.
 */
export function AuctionCard({ auctionId }: { auctionId: bigint }) {
  const { auction, refetch } = useAuction(auctionId);
  const bidManager = tryContractRef("BidManager");
  const auctionHouse = tryContractRef("AuctionHouse");
  const erc20 = useErc20(auction?.paymentToken, bidManager?.address);
  const [bidInput, setBidInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const approveTx = useTx({ successLabel: "Bid token approved", onConfirmed: () => erc20.refetch() });
  const bidTx = useTx({ successLabel: "Bid placed", onConfirmed: () => { refetch(); erc20.refetch(); } });
  const settleTx = useTx({ successLabel: "Auction settled", onConfirmed: () => refetch() });

  if (!auction || auction.state === AuctionState.None) {
    return null;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const ended = nowSec >= auction.endTime;
  const isActive = auction.state === AuctionState.Active;
  const parsedBid = parseTokenInput(bidInput || "", erc20.decimals);
  const minBid = auction.highestBid > auction.reservePrice ? auction.highestBid + 1n : auction.reservePrice;
  const needsApproval = parsedBid.value !== null && erc20.allowance < parsedBid.value;

  const onApprove = async () => {
    setError(null);
    if (!auction.paymentToken || !bidManager) return;
    if (parsedBid.value === null) return setError(parsedBid.error ?? "Invalid amount");
    try {
      await approveTx.submit({
        address: auction.paymentToken,
        abi: erc20Approve,
        functionName: "approve",
        args: [bidManager.address, parsedBid.value],
      });
    } catch (e) {
      approveTx.reset();
      setError(getErrorMessage(e));
    }
  };

  const onBid = async () => {
    setError(null);
    if (!auctionHouse) return;
    if (parsedBid.value === null) return setError(parsedBid.error ?? "Invalid amount");
    if (parsedBid.value < minBid) return setError(`Bid must be at least ${formatTokenAmount(minBid, erc20.decimals)}.`);
    if (erc20.balance < parsedBid.value) return setError("Insufficient token balance.");
    try {
      await bidTx.submit({ address: auctionHouse.address, abi: auctionHouse.abi, functionName: "bid", args: [auctionId, parsedBid.value] });
    } catch (e) {
      bidTx.reset();
      setError(getErrorMessage(e));
    }
  };

  const onSettle = async () => {
    setError(null);
    if (!auctionHouse) return;
    try {
      await settleTx.submit({ address: auctionHouse.address, abi: auctionHouse.abi, functionName: "settleAuction", args: [auctionId] });
    } catch (e) {
      settleTx.reset();
      setError(getErrorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader
        title={`Auction #${auctionId.toString()}`}
        action={<Badge tone={STATE_TONE[auction.state] ?? "neutral"}>{AUCTION_STATE_LABEL[auction.state]}</Badge>}
      />
      <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <Info label="NFT">
          <AddressBadge address={auction.nft} /> <span className="text-xs text-muted">#{auction.tokenId.toString()}</span>
        </Info>
        <Info label="Seller">
          <AddressLink address={auction.seller} />
        </Info>
        <Info label="Highest bid">
          {auction.highestBid > 0n ? `${formatTokenAmount(auction.highestBid, erc20.decimals)} ${erc20.symbol}` : "No bids"}
        </Info>
        <Info label="Reserve">{`${formatTokenAmount(auction.reservePrice, erc20.decimals)} ${erc20.symbol}`}</Info>
        <Info label="Ends">{formatTimestamp(auction.endTime)}</Info>
        <Info label="Leader">
          {auction.highestBidder && auction.highestBid > 0n ? <AddressLink address={auction.highestBidder} /> : "—"}
        </Info>
      </dl>

      {isActive && !ended ? (
        <div className="space-y-2">
          <Field
            label={`Your bid (${erc20.symbol})`}
            htmlFor={`bid-${auctionId}`}
            hint={`Minimum ${formatTokenAmount(minBid, erc20.decimals)} ${erc20.symbol}`}
          >
            <Input
              id={`bid-${auctionId}`}
              inputMode="decimal"
              placeholder={formatTokenAmount(minBid, erc20.decimals)}
              value={bidInput}
              onChange={(e) => setBidInput(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {needsApproval ? (
              <Button onClick={onApprove} loading={approveTx.isBusy}>
                Approve {erc20.symbol}
              </Button>
            ) : null}
            <Button onClick={onBid} loading={bidTx.isBusy} disabled={needsApproval || parsedBid.value === null}>
              Place bid
            </Button>
          </div>
        </div>
      ) : null}

      {isActive && ended ? (
        <Button variant="secondary" onClick={onSettle} loading={settleTx.isBusy}>
          Settle auction
        </Button>
      ) : null}

      {error ? <p className="field-error mt-3">{error}</p> : null}
      {[approveTx.hash, bidTx.hash, settleTx.hash].filter(Boolean).map((hash) => (
        <p key={hash} className="mt-1 text-xs text-muted">
          Tx: <TxLink hash={hash as string} />
        </p>
      ))}
    </Card>
  );
}

const erc20Approve = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-fg">{children}</dd>
    </div>
  );
}
