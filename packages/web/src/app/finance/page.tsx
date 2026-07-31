"use client";

import { useMemo, useState } from "react";
import { InvoiceListingState } from "@proofchain/shared";
import { useFinancingListings } from "@/hooks/useFinancingListings";
import { useUsdc } from "@/hooks/useUsdc";
import { ListingCard } from "@/components/finance/ListingCard";
import { ListReceivableForm } from "@/components/finance/ListReceivableForm";
import { RequireWallet } from "@/components/RequireWallet";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { getResolvedAddress } from "@/lib/shared";
import { formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { isListingClosed, openListings } from "@/lib/finance";

type Filter = "open" | "all";

export default function FinanceMarketplacePage() {
  const deployed = Boolean(getResolvedAddress("InvoiceFinancing"));
  const { listings, isLoading, isError, error, refetch } = useFinancingListings();
  const usdc = useUsdc();
  const [filter, setFilter] = useState<Filter>("open");

  const open = useMemo(() => openListings(listings), [listings]);
  const shown = filter === "open" ? open : listings;

  const totalOpenAsk = useMemo(
    () => open.reduce((sum, r) => sum + (r.askAmount ?? 0n), 0n),
    [open],
  );
  const funded = listings.filter((r) => r.state === InvoiceListingState.Funded).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Financing marketplace</h1>
          <p className="mt-1 text-sm text-muted">
            Suppliers list attested receivables; lenders advance capital and become the escrow payee.
          </p>
        </div>
        <Badge tone="success">
          <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          Live
        </Badge>
      </div>

      {!deployed ? (
        <EmptyState
          title="Financing is not available on this network"
          description="The InvoiceFinancing contract is not deployed for the configured chain."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Open listings" value={open.length} loading={isLoading} />
            <StatCard label="In financing" value={funded} loading={isLoading} />
            <StatCard
              label="Open ask volume"
              value={`${formatTokenAmount(totalOpenAsk, usdc.decimals)} ${usdc.symbol}`}
              loading={isLoading}
            />
          </div>

          <RequireWallet>
            <ListReceivableForm decimals={usdc.decimals} symbol={usdc.symbol} onListed={() => void refetch()} />
          </RequireWallet>

          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Listings</h2>
            <div className="flex gap-2">
              <Button size="sm" variant={filter === "open" ? "primary" : "secondary"} onClick={() => setFilter("open")}>
                Open ({open.length})
              </Button>
              <Button size="sm" variant={filter === "all" ? "primary" : "secondary"} onClick={() => setFilter("all")}>
                All ({listings.length})
              </Button>
            </div>
          </div>

          {isLoading ? (
            <LoadingState label="Indexing financing listings…" />
          ) : isError ? (
            <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
          ) : shown.length === 0 ? (
            <EmptyState
              title={filter === "open" ? "No open listings" : "No listings yet"}
              description="List an attested receivable above to offer it for financing."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {shown.map((record) => (
                <ListingCard
                  key={`${record.batchId}-${record.order}`}
                  record={record}
                  decimals={usdc.decimals}
                  symbol={usdc.symbol}
                  onChanged={() => void refetch()}
                />
              ))}
            </div>
          )}

          {shown.some((r) => isListingClosed(r.state)) && filter === "all" ? (
            <p className="text-xs text-muted">Closed listings (claimed or cancelled) are shown for history.</p>
          ) : null}
        </>
      )}
    </div>
  );
}
