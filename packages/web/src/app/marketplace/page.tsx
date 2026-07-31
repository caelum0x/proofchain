"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useListings, ASSET_KIND_LABEL, AssetKind, type ListingEvent } from "@/hooks/useMarketplace";
import { useListParams } from "@/hooks/t5-useListParams";
import { ResourceListView } from "@/components/t5/ResourceListView";
import { SearchInput, SelectFilter, ExportButton } from "@/components/t5/Filters";
import { applyTableState, compareBigint, type Comparator } from "@/components/t5/table-utils";
import { fmtNumber } from "@/components/t5/format";
import { ListingStatusCell, ListingActionsCell } from "@/components/t5/ListingCells";
import { CreateListingForm } from "@/components/marketplace/CreateListingForm";
import { RequireWallet } from "@/components/RequireWallet";
import { DataTable, type Column, type SortState } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/States";

const KIND_OPTIONS = [
  { value: String(AssetKind.Receivable), label: "Receivable" },
  { value: String(AssetKind.ERC721), label: "ERC721" },
  { value: String(AssetKind.ERC1155), label: "ERC1155" },
];

const comparators: Readonly<Record<string, Comparator<ListingEvent>>> = {
  listingId: (a, b) => compareBigint(a.listingId, b.listingId),
  price: (a, b) => compareBigint(a.price, b.price),
};

function MarketplaceInner() {
  const params = useListParams({ facets: ["kind"], defaultSort: "listingId" });
  const kind = params.facet("kind");
  const { listings, isLoading, isError, error, refetch, notDeployed } = useListings();

  const filtered = useMemo(() => {
    if (!kind) return listings;
    return listings.filter((l) => String(l.kind) === kind);
  }, [listings, kind]);

  const { rows, total } = useMemo(
    () =>
      applyTableState({
        rows: filtered,
        q: params.q,
        search: (l) => `${l.listingId} ${l.asset} ${l.seller} ${l.price}`,
        sortId: params.sortId,
        sortDir: params.sortDir,
        comparators,
        page: params.page,
        limit: params.limit,
      }),
    [filtered, params.q, params.sortId, params.sortDir, params.page, params.limit],
  );

  const columns = useMemo<readonly Column<ListingEvent>[]>(
    () => [
      { id: "listingId", header: "#", sortable: true, cell: (l) => <span className="font-mono text-xs text-muted">{l.listingId.toString()}</span> },
      { id: "kind", header: "Kind", cell: (l) => <Badge tone="neutral">{ASSET_KIND_LABEL[l.kind] ?? "—"}</Badge> },
      {
        id: "asset",
        header: "Asset",
        cell: (l) => (
          <span className="flex items-center gap-1.5">
            <AddressBadge address={l.asset} /> <span className="text-xs text-muted">#{l.assetId.toString()}</span>
          </span>
        ),
      },
      { id: "seller", header: "Seller", cell: (l) => <AddressBadge address={l.seller} /> },
      { id: "price", header: "Price", align: "right", sortable: true, cell: (l) => <span className="font-mono">{l.price.toString()}</span> },
      { id: "status", header: "Status", cell: (l) => <ListingStatusCell listing={l} /> },
      { id: "actions", header: "", align: "right", cell: (l) => <ListingActionsCell listing={l} onDone={refetch} /> },
    ],
    [refetch],
  );

  const sort: SortState | null = params.sortId ? { id: params.sortId, dir: params.sortDir } : null;

  return (
    <ResourceListView
      title="Marketplace"
      subtitle="Fixed-price listings for tokenized assets — receivables, NFTs, and carbon credits."
      breadcrumbs={[{ label: "Markets" }, { label: "Marketplace" }]}
      icon="marketplace"
      accentClassName="text-markets"
      actions={
        <div className="flex gap-2">
          <Link href="/marketplace/auctions">
            <Button variant="secondary" size="sm">
              Auctions
            </Button>
          </Link>
          <Link href="/order-book">
            <Button variant="secondary" size="sm">
              Order book
            </Button>
          </Link>
        </div>
      }
      kpis={[
        { label: "Listings", value: fmtNumber(listings.length) },
        { label: "Receivables", value: fmtNumber(listings.filter((l) => l.kind === AssetKind.Receivable).length) },
        { label: "NFTs", value: fmtNumber(listings.filter((l) => l.kind === AssetKind.ERC721).length) },
        { label: "Sellers", value: fmtNumber(new Set(listings.map((l) => l.seller)).size) },
      ]}
      kpisLoading={isLoading}
      toolbar={
        <>
          <SearchInput value={params.q} onChange={params.setQ} placeholder="Search asset or seller" />
          <SelectFilter label="Kind" value={kind} onChange={(v) => params.setFacet("kind", v || null)} options={KIND_OPTIONS} />
        </>
      }
      toolbarActions={
        <ExportButton
          filename="marketplace.csv"
          disabled={rows.length === 0}
          getCsv={() =>
            [
              "ListingId,Kind,Asset,AssetId,Seller,Price",
              ...rows.map((l) => `${l.listingId},${ASSET_KIND_LABEL[l.kind]},${l.asset},${l.assetId},${l.seller},${l.price}`),
            ].join("\n")
          }
        />
      }
    >
      {notDeployed ? (
        <EmptyState title="ListingRegistry not deployed" description="The marketplace contract is not configured on this network." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(l) => l.listingId.toString()}
              isLoading={isLoading}
              error={isError ? String(error) : null}
              onRetry={refetch}
              emptyTitle="No listings yet"
              emptyDescription="Created listings appear here in real time."
              sort={sort}
              onSortChange={(s) => params.toggleSort(s.id)}
              stickyHeader
            />
            <Pagination page={params.page} limit={params.limit} total={total} onPageChange={params.setPage} />
          </div>
          <div className="space-y-4">
            <RequireWallet>
              <CreateListingForm onDone={refetch} />
            </RequireWallet>
            <Card>
              <CardHeader title="Other venues" />
              <div className="flex flex-col gap-2">
                <Link href="/marketplace/auctions" className="text-sm text-brand hover:underline">
                  English auctions →
                </Link>
                <Link href="/order-book" className="text-sm text-brand hover:underline">
                  Limit order book →
                </Link>
                <Link href="/nft" className="text-sm text-brand hover:underline">
                  Tokenized assets →
                </Link>
              </div>
            </Card>
          </div>
        </div>
      )}
    </ResourceListView>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={<LoadingState label="Loading marketplace…" />}>
      <MarketplaceInner />
    </Suspense>
  );
}
