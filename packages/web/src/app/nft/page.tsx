"use client";

import { Suspense, useMemo } from "react";
import { useAccount } from "wagmi";
import { NFT_COLLECTIONS, useNftCollection, isNftCollection, type NftCollectionName, type NftItem } from "@/hooks/useNfts";
import { useListParams } from "@/hooks/t5-useListParams";
import { ResourceListView } from "@/components/t5/ResourceListView";
import { SearchInput, SelectFilter } from "@/components/t5/Filters";
import { applyTableState, compareBigint, type Comparator } from "@/components/t5/table-utils";
import { fmtNumber } from "@/components/t5/format";
import { NftCard } from "@/components/nft/NftCard";
import { CardGrid } from "@/components/ui/CardGrid";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/States";

const COLLECTION_OPTIONS = NFT_COLLECTIONS.map((c) => ({ value: c.name, label: c.label }));

const comparators: Readonly<Record<string, Comparator<NftItem>>> = {
  tokenId: (a, b) => compareBigint(a.tokenId, b.tokenId),
};

function NftInner() {
  const { address } = useAccount();
  const params = useListParams({ facets: ["collection", "mine"], defaultSort: "tokenId", limit: 12 });

  const collectionParam = params.facet("collection");
  const collection: NftCollectionName = isNftCollection(collectionParam) ? collectionParam : "BatchNFT";
  const mineOnly = params.facet("mine") === "1";

  const result = useNftCollection(collection, mineOnly ? address : undefined);
  const meta = NFT_COLLECTIONS.find((c) => c.name === collection);

  const { rows, total } = useMemo(
    () =>
      applyTableState({
        rows: result.items,
        q: params.q,
        search: (item) => `${item.tokenId} ${item.owner}`,
        sortId: params.sortId,
        sortDir: params.sortDir,
        comparators,
        page: params.page,
        limit: params.limit,
      }),
    [result.items, params.q, params.sortId, params.sortDir, params.page, params.limit],
  );

  return (
    <ResourceListView
      title="Tokenized assets"
      subtitle="Batch titles, receivable NFTs, and warehouse receipts — transferable on-chain claims minted across the lifecycle."
      breadcrumbs={[{ label: "Markets" }, { label: "Tokenized assets" }]}
      icon="nft"
      accentClassName="text-markets"
      kpis={[
        { label: "Tokens", value: fmtNumber(result.items.length) },
        { label: "Collection", value: meta?.label ?? collection },
        { label: "Holders", value: fmtNumber(new Set(result.items.map((i) => i.owner)).size) },
      ]}
      kpisLoading={result.isLoading}
      toolbar={
        <>
          <SearchInput value={params.q} onChange={params.setQ} placeholder="Search token id or owner" />
          <SelectFilter
            label="Collection"
            value={collection}
            allLabel={meta?.label ?? "Collection"}
            onChange={(v) => params.setFacet("collection", v || null)}
            options={COLLECTION_OPTIONS}
          />
          <Button
            variant={mineOnly ? "primary" : "secondary"}
            size="sm"
            disabled={!address}
            onClick={() => params.setFacet("mine", mineOnly ? null : "1")}
          >
            {mineOnly ? "Showing mine" : "Show only mine"}
          </Button>
        </>
      }
    >
      {result.notDeployed ? (
        <EmptyState title="Collection not deployed" description={`${meta?.label ?? collection} is not configured on this network.`} />
      ) : (
        <>
          <CardGrid
            items={rows}
            getKey={(item) => `${item.collection}-${item.tokenId}`}
            minColWidth={240}
            isLoading={result.isLoading}
            error={result.isError ? "Failed to index tokens." : null}
            onRetry={result.refetch}
            emptyTitle={mineOnly ? "You own no tokens here" : "No tokens minted yet"}
            emptyDescription={
              mineOnly ? "Tokens you own in this collection will appear here." : "Minted tokens will appear here in real time."
            }
            renderItem={(item) => <NftCard item={item} />}
          />
          <Pagination page={params.page} limit={params.limit} total={total} onPageChange={params.setPage} />
        </>
      )}
    </ResourceListView>
  );
}

export default function NftPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading tokenized assets…" />}>
      <NftInner />
    </Suspense>
  );
}
