"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useAuctions, type AuctionStartedItem } from "@/hooks/useAuctions";
import { useListParams } from "@/hooks/t5-useListParams";
import { ResourceListView } from "@/components/t5/ResourceListView";
import { SearchInput, SelectFilter } from "@/components/t5/Filters";
import { applyTableState, compareBigint, type Comparator } from "@/components/t5/table-utils";
import { fmtNumber } from "@/components/t5/format";
import { AuctionSummaryCard } from "@/components/t5/AuctionSummaryCard";
import { StartAuctionForm } from "@/components/auctions/StartAuctionForm";
import { RequireWallet } from "@/components/RequireWallet";
import { CardGrid } from "@/components/ui/CardGrid";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/States";

const CLOCK_OPTIONS = [
  { value: "live", label: "Live" },
  { value: "ended", label: "Ended" },
];

const comparators: Readonly<Record<string, Comparator<AuctionStartedItem>>> = {
  auctionId: (a, b) => compareBigint(a.auctionId, b.auctionId),
  endTime: (a, b) => a.endTime - b.endTime,
};

function AuctionsInner() {
  const params = useListParams({ facets: ["clock"], defaultSort: "auctionId", limit: 9 });
  const clock = params.facet("clock");
  const { auctions, isLoading, isError, error, refetch, notDeployed } = useAuctions();

  const nowSec = Math.floor(Date.now() / 1000);
  const filtered = useMemo(() => {
    if (!clock) return auctions;
    return auctions.filter((a) => (clock === "live" ? a.endTime > nowSec : a.endTime <= nowSec));
  }, [auctions, clock, nowSec]);

  const { rows, total } = useMemo(
    () =>
      applyTableState({
        rows: filtered,
        q: params.q,
        search: (a) => `${a.auctionId} ${a.nft} ${a.seller}`,
        sortId: params.sortId,
        sortDir: params.sortDir,
        comparators,
        page: params.page,
        limit: params.limit,
      }),
    [filtered, params.q, params.sortId, params.sortDir, params.page, params.limit],
  );

  const live = auctions.filter((a) => a.endTime > nowSec).length;

  return (
    <ResourceListView
      title="Auctions"
      subtitle="English auctions for tokenized assets — bids escrowed, losing bids refunded automatically on settle."
      breadcrumbs={[{ label: "Markets" }, { label: "Marketplace", href: "/marketplace" }, { label: "Auctions" }]}
      icon="auction"
      accentClassName="text-markets"
      actions={
        <Link href="/marketplace">
          <Button variant="secondary" size="sm">
            Marketplace
          </Button>
        </Link>
      }
      kpis={[
        { label: "Auctions", value: fmtNumber(auctions.length) },
        { label: "Live", value: fmtNumber(live), hintTone: "success" },
        { label: "Ended", value: fmtNumber(auctions.length - live) },
        { label: "Sellers", value: fmtNumber(new Set(auctions.map((a) => a.seller)).size) },
      ]}
      kpisLoading={isLoading}
      toolbar={
        <>
          <SearchInput value={params.q} onChange={params.setQ} placeholder="Search NFT or seller" />
          <SelectFilter label="Clock" value={clock} onChange={(v) => params.setFacet("clock", v || null)} options={CLOCK_OPTIONS} />
        </>
      }
    >
      {notDeployed ? (
        <EmptyState title="AuctionHouse not deployed" description="The auction contract is not configured on this network." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <CardGrid
              items={rows}
              getKey={(a) => a.auctionId.toString()}
              minColWidth={240}
              isLoading={isLoading}
              error={isError ? String(error) : null}
              onRetry={refetch}
              emptyTitle="No auctions yet"
              emptyDescription="Start one from the panel to list a tokenized asset for bidding."
              renderItem={(a) => <AuctionSummaryCard auctionId={a.auctionId} />}
            />
            <Pagination page={params.page} limit={params.limit} total={total} onPageChange={params.setPage} />
          </div>
          <div>
            <RequireWallet>
              <StartAuctionForm onDone={refetch} />
            </RequireWallet>
          </div>
        </div>
      )}
    </ResourceListView>
  );
}

export default function AuctionsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading auctions…" />}>
      <AuctionsInner />
    </Suspense>
  );
}
