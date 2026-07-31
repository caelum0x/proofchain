"use client";

import Link from "next/link";
import { useAuctions } from "@/hooks/useAuctions";
import { AuctionCard } from "@/components/auctions/AuctionCard";
import { StartAuctionForm } from "@/components/auctions/StartAuctionForm";
import { RequireWallet } from "@/components/RequireWallet";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { getErrorMessage } from "@/lib/errors";

export default function AuctionsPage() {
  const { auctions, isLoading, isError, error, refetch, notDeployed } = useAuctions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Auctions</h1>
          <p className="mt-1 text-sm text-muted">
            English auctions for invoice NFTs, batch titles, and warehouse receipts. Bids are escrowed
            and losing bids refunded automatically.
          </p>
        </div>
        <Link href="/marketplace" className="text-sm text-brand hover:underline">
          ← Marketplace
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {notDeployed ? (
            <EmptyState title="AuctionHouse not deployed" description="Not configured on this network." />
          ) : isLoading ? (
            <LoadingState label="Loading auctions…" />
          ) : isError ? (
            <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
          ) : auctions.length === 0 ? (
            <EmptyState
              title="No auctions yet"
              description="Start one from the panel to list a tokenized asset for bidding."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {auctions.map((a) => (
                <AuctionCard key={a.auctionId.toString()} auctionId={a.auctionId} />
              ))}
            </div>
          )}
        </div>

        <div>
          <RequireWallet>
            <StartAuctionForm onDone={refetch} />
          </RequireWallet>
        </div>
      </div>
    </div>
  );
}
