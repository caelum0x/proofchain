"use client";

import Link from "next/link";
import { useAuction, AUCTION_STATE_LABEL } from "@/hooks/useAuctions";
import { useErc20 } from "@/hooks/useErc20";
import { Card } from "@/components/ui/Card";
import { StatusBadge, type SemanticStatus } from "@/components/ui/StatusBadge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Button } from "@/components/ui/Button";
import { DefinitionList } from "./DefinitionList";
import { formatTimestamp, formatTokenAmount } from "@/lib/format";

const STATE_TONE: Record<number, SemanticStatus> = { 0: "neutral", 1: "brand", 2: "success", 3: "neutral" };

/** Compact auction card for the auctions grid — live state + link to detail. */
export function AuctionSummaryCard({ auctionId }: { readonly auctionId: bigint }) {
  const { auction } = useAuction(auctionId);
  const erc20 = useErc20(auction?.paymentToken, undefined);

  if (!auction) {
    return (
      <Card className="h-full">
        <div className="h-24 animate-pulse rounded-lg bg-surface-2" />
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-sm font-semibold text-fg">Auction #{auctionId.toString()}</span>
        <StatusBadge status={STATE_TONE[auction.state] ?? "neutral"}>{AUCTION_STATE_LABEL[auction.state]}</StatusBadge>
      </div>
      <DefinitionList
        items={[
          { label: "NFT", value: <AddressBadge address={auction.nft} /> },
          { label: "Token", value: <span className="font-mono">#{auction.tokenId.toString()}</span> },
          {
            label: "Highest bid",
            value:
              auction.highestBid > 0n ? (
                <span className="font-mono">{formatTokenAmount(auction.highestBid, erc20.decimals)} {erc20.symbol}</span>
              ) : (
                <span className="text-muted">No bids</span>
              ),
          },
          { label: "Ends", value: <span className="text-xs">{formatTimestamp(auction.endTime)}</span> },
        ]}
      />
      <Link href={`/marketplace/auctions/${auctionId.toString()}`} className="mt-4">
        <Button variant="secondary" size="sm" className="w-full">
          View auction
        </Button>
      </Link>
    </Card>
  );
}
