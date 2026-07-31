"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { NFT_COLLECTIONS, useNftCollection, type NftCollectionName } from "@/hooks/useNfts";
import { NftCard } from "@/components/nft/NftCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/cn";

export default function NftPage() {
  const { address } = useAccount();
  const [active, setActive] = useState<NftCollectionName>("BatchNFT");
  const [mineOnly, setMineOnly] = useState(false);

  const collection = useNftCollection(active, mineOnly ? address : undefined);
  const meta = NFT_COLLECTIONS.find((c) => c.name === active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tokenized assets</h1>
        <p className="mt-1 text-sm text-muted">
          Batch titles, receivable NFTs, and warehouse receipts — transferable on-chain claims minted
          across the ProofChain lifecycle.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {NFT_COLLECTIONS.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setActive(c.name)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                active === c.name
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border bg-surface text-muted hover:bg-surface-2",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Button
          variant={mineOnly ? "primary" : "secondary"}
          size="sm"
          onClick={() => setMineOnly((v) => !v)}
          disabled={!address}
        >
          {mineOnly ? "Showing mine" : "Show only mine"}
        </Button>
      </div>

      {meta ? (
        <Card className="bg-surface/60">
          <p className="text-sm text-muted">{meta.description}</p>
        </Card>
      ) : null}

      {collection.notDeployed ? (
        <EmptyState title="Collection not deployed" description={`${meta?.label ?? active} is not configured on this network.`} />
      ) : collection.isLoading ? (
        <LoadingState label="Indexing tokens…" />
      ) : collection.isError ? (
        <ErrorState message={getErrorMessage(collection.error)} onRetry={collection.refetch} />
      ) : collection.items.length === 0 ? (
        <EmptyState
          title={mineOnly ? "You own no tokens here" : "No tokens minted yet"}
          description={
            mineOnly
              ? "Tokens you own in this collection will appear here."
              : "Minted tokens in this collection will appear here in real time."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collection.items.map((item) => (
            <NftCard key={`${item.collection}-${item.tokenId}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
