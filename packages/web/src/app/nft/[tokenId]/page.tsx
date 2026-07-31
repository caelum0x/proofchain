"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { NFT_COLLECTIONS, isNftCollection, useNft, type NftCollectionName } from "@/hooks/useNfts";
import { useNftMetadata } from "@/hooks/useNftMetadata";
import { NftActions } from "@/components/nft/NftActions";
import { RequireWallet } from "@/components/RequireWallet";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AddressLink } from "@/components/ui/TxLink";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { ipfsToHttp, formatTokenAmount, shortenHex } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";

export default function NftDetailPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading token…" />}>
      <NftDetailInner />
    </Suspense>
  );
}

function NftDetailInner() {
  const params = useParams<{ tokenId: string }>();
  const search = useSearchParams();
  const rawId = Array.isArray(params.tokenId) ? params.tokenId[0] : params.tokenId;
  const tokenId = rawId && /^\d+$/.test(rawId) ? BigInt(rawId) : undefined;

  const collectionParam = search.get("collection") ?? "BatchNFT";
  const collection: NftCollectionName = isNftCollection(collectionParam) ? collectionParam : "BatchNFT";

  const nft = useNft(collection, tokenId);
  const metadata = useNftMetadata(nft.tokenURI || undefined);

  if (!tokenId) {
    return <ErrorState title="Invalid token id" message="The URL does not contain a valid numeric token id." />;
  }

  const image = metadata.data?.image ? ipfsToHttp(metadata.data.image) : undefined;
  const name = metadata.data?.name ?? `Token #${rawId}`;
  const label = NFT_COLLECTIONS.find((c) => c.name === collection)?.label ?? collection;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/nft" className="text-xs text-brand hover:underline">
            ← All assets
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{name}</h1>
          <p className="font-mono text-xs text-muted">
            {label} · #{rawId && rawId.length > 14 ? shortenHex(rawId, 6, 6) : rawId}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {NFT_COLLECTIONS.map((c) => (
            <Link
              key={c.name}
              href={`/nft/${rawId}?collection=${c.name}`}
              className={
                c.name === collection
                  ? "rounded-lg border border-brand bg-brand/10 px-3 py-1.5 text-xs text-brand"
                  : "rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted hover:bg-surface-2"
              }
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      {nft.isLoading ? (
        <LoadingState label="Loading token…" />
      ) : nft.isError ? (
        <ErrorState
          title="Token not found"
          message={`No ${label} token with this id exists. Try another collection above. (${getErrorMessage(nft.error)})`}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-0">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-t-xl bg-surface-2">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt={name} className="h-full w-full object-cover" />
              ) : (
                <span className="font-mono text-sm text-muted">No image</span>
              )}
            </div>
            {metadata.data?.description ? (
              <p className="p-4 text-sm text-muted">{metadata.data.description}</p>
            ) : null}
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Details" />
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Owner">{nft.owner ? <AddressLink address={nft.owner} /> : "—"}</Info>
                <Info label="Collection">{label}</Info>
                {nft.batchId ? (
                  <Info label="Batch">
                    <Link href={`/disputes/${nft.batchId}`} className="font-mono text-xs text-brand hover:underline">
                      {shortenHex(nft.batchId, 6, 6)}
                    </Link>
                  </Info>
                ) : null}
                {nft.receipt ? (
                  <>
                    <Info label="Quantity">{formatTokenAmount(nft.receipt.quantity, 0)}</Info>
                    <Info label="Location">{nft.receipt.location || "—"}</Info>
                    <Info label="Status">
                      {nft.receipt.redeemed ? <Badge tone="neutral">Redeemed</Badge> : <Badge tone="success">Active</Badge>}
                    </Info>
                  </>
                ) : null}
                {nft.tokenURI ? (
                  <Info label="Metadata">
                    <a href={ipfsToHttp(nft.tokenURI)} target="_blank" rel="noreferrer noopener" className="text-brand hover:underline">
                      Open URI
                    </a>
                  </Info>
                ) : null}
              </dl>
            </Card>

            <Card>
              <CardHeader title="Actions" />
              <RequireWallet>
                <NftActions
                  collection={collection}
                  tokenId={tokenId}
                  owner={nft.owner}
                  redeemable={collection === "WarehouseReceipt" && nft.receipt?.redeemed === false}
                  onDone={nft.refetch}
                />
              </RequireWallet>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-fg">{children}</dd>
    </div>
  );
}
