"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuction, AUCTION_STATE_LABEL, AuctionState } from "@/hooks/useAuctions";
import { useAuctionBids } from "@/hooks/useAuctionBids";
import { useErc20 } from "@/hooks/useErc20";
import { AuctionCard } from "@/components/auctions/AuctionCard";
import { RequireWallet } from "@/components/RequireWallet";
import { DetailShell } from "@/components/shells/DetailShell";
import { PageHeader } from "@/components/page/PageHeader";
import { InfoCard } from "@/components/t5/DefinitionList";
import { Card, CardHeader } from "@/components/ui/Card";
import { Timeline, type TimelineEvent } from "@/components/ui/Timeline";
import { StatusBadge, type SemanticStatus } from "@/components/ui/StatusBadge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { formatTimestamp, formatTokenAmount, shortenHex } from "@/lib/format";

const STATE_TONE: Record<number, SemanticStatus> = { 0: "neutral", 1: "brand", 2: "success", 3: "neutral" };

export default function AuctionDetailPage() {
  const routeParams = useParams<{ id: string }>();
  const raw = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;
  const auctionId = raw && /^\d+$/.test(raw) ? BigInt(raw) : undefined;

  const { auction, isLoading, error, refetch } = useAuction(auctionId);
  const bidsQuery = useAuctionBids(auctionId);
  const erc20 = useErc20(auction?.paymentToken, undefined);

  const timeline = useMemo<readonly TimelineEvent[]>(
    () =>
      bidsQuery.bids.map((bid, index) => ({
        id: bid.key,
        title: `Bid · ${formatTokenAmount(bid.amount, erc20.decimals)} ${erc20.symbol}`,
        description: `by ${shortenHex(bid.bidder, 6, 4)}`,
        timestamp: `block ${bid.blockNumber.toString()}`,
        tone: index === 0 ? "success" : "neutral",
      })),
    [bidsQuery.bids, erc20.decimals, erc20.symbol],
  );

  if (!auctionId) {
    return <ErrorState title="Invalid auction id" message="The URL does not contain a valid numeric auction id." />;
  }

  return (
    <DetailShell
      header={
        <PageHeader
          title={`Auction #${auctionId.toString()}`}
          subtitle="English auction for a tokenized asset — live bids escrowed, losers refunded on settle."
          breadcrumbs={[
            { label: "Markets" },
            { label: "Marketplace", href: "/marketplace" },
            { label: "Auctions", href: "/marketplace/auctions" },
            { label: `#${auctionId.toString()}` },
          ]}
          icon="auction"
          accentClassName="text-markets"
          actions={
            <Link href="/marketplace/auctions">
              <Button variant="secondary" size="sm">
                All auctions
              </Button>
            </Link>
          }
        />
      }
      rail={
        <RequireWallet>
          <AuctionCard auctionId={auctionId} />
        </RequireWallet>
      }
    >
      {isLoading ? (
        <LoadingState label="Loading auction…" />
      ) : error ? (
        <ErrorState message={String(error)} onRetry={refetch} />
      ) : !auction || auction.state === AuctionState.None ? (
        <ErrorState title="Auction not found" message="No auction with this id exists on this network." />
      ) : (
        <>
          <InfoCard
            title="Overview"
            action={<StatusBadge status={STATE_TONE[auction.state] ?? "neutral"}>{AUCTION_STATE_LABEL[auction.state]}</StatusBadge>}
            items={[
              { label: "NFT", value: <AddressBadge address={auction.nft} /> },
              { label: "Token", value: <span className="font-mono">#{auction.tokenId.toString()}</span> },
              { label: "Seller", value: <AddressBadge address={auction.seller} /> },
              { label: "Payment", value: <AddressBadge address={auction.paymentToken} /> },
              { label: "Reserve", value: <span className="font-mono">{formatTokenAmount(auction.reservePrice, erc20.decimals)} {erc20.symbol}</span> },
              {
                label: "Highest bid",
                value:
                  auction.highestBid > 0n ? (
                    <span className="font-mono">{formatTokenAmount(auction.highestBid, erc20.decimals)} {erc20.symbol}</span>
                  ) : (
                    <span className="text-muted">No bids</span>
                  ),
              },
              {
                label: "Leader",
                value: auction.highestBid > 0n ? <AddressBadge address={auction.highestBidder} /> : <span className="text-muted">—</span>,
              },
              { label: "Ends", value: formatTimestamp(auction.endTime) },
            ]}
          />

          <Card>
            <CardHeader title="Bid history" description={`${bidsQuery.bids.length} bid${bidsQuery.bids.length === 1 ? "" : "s"} placed.`} />
            {bidsQuery.isLoading ? (
              <LoadingState label="Loading bids…" />
            ) : timeline.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No bids placed yet.</p>
            ) : (
              <Timeline events={timeline} />
            )}
          </Card>
        </>
      )}
    </DetailShell>
  );
}
