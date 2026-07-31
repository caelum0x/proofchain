"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { NFT_COLLECTIONS, isNftCollection, useNft, type NftCollectionName } from "@/hooks/useNfts";
import { useNftMetadata } from "@/hooks/useNftMetadata";
import { NftActions } from "@/components/nft/NftActions";
import { RequireWallet } from "@/components/RequireWallet";
import { DetailShell } from "@/components/shells/DetailShell";
import { PageHeader } from "@/components/page/PageHeader";
import { InfoCard, DefinitionList, type DefinitionItem } from "@/components/t5/DefinitionList";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { ipfsToHttp, formatTokenAmount, shortenHex } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";

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
  const displayId = rawId && rawId.length > 14 ? shortenHex(rawId, 6, 6) : rawId;

  const detailItems: DefinitionItem[] = [
    { label: "Owner", value: nft.owner ? <AddressBadge address={nft.owner} /> : "—", wide: true },
    { label: "Collection", value: label },
    { label: "Token id", value: <span className="font-mono">{displayId}</span> },
  ];
  if (nft.batchId) {
    detailItems.push({
      label: "Batch",
      value: (
        <Link href={`/batches/${nft.batchId}`} className="font-mono text-xs text-brand hover:underline">
          {shortenHex(nft.batchId, 6, 6)}
        </Link>
      ),
      wide: true,
    });
  }
  if (nft.receipt) {
    detailItems.push(
      { label: "Quantity", value: <span className="font-mono">{formatTokenAmount(nft.receipt.quantity, 0)}</span> },
      { label: "Location", value: nft.receipt.location || "—" },
      {
        label: "Status",
        value: <StatusBadge status={nft.receipt.redeemed ? "neutral" : "success"}>{nft.receipt.redeemed ? "Redeemed" : "Active"}</StatusBadge>,
      },
    );
  }

  return (
    <DetailShell
      header={
        <PageHeader
          title={name}
          subtitle={`${label} · #${displayId}`}
          breadcrumbs={[{ label: "Markets" }, { label: "Tokenized assets", href: "/nft" }, { label: `#${displayId}` }]}
          icon="nft"
          accentClassName="text-markets"
          actions={
            <Link href="/nft">
              <Button variant="secondary" size="sm">
                All assets
              </Button>
            </Link>
          }
        />
      }
      rail={
        <>
          <InfoCard title="Details" items={detailItems} />
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
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        {NFT_COLLECTIONS.map((c) => (
          <Link
            key={c.name}
            href={`/nft/${rawId}?collection=${c.name}`}
            className={
              c.name === collection
                ? "rounded-lg border border-markets bg-markets/10 px-3 py-1.5 text-xs text-markets"
                : "rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted hover:bg-surface-2"
            }
          >
            {c.label}
          </Link>
        ))}
      </div>

      {nft.isLoading ? (
        <LoadingState label="Loading token…" />
      ) : nft.isError ? (
        <ErrorState
          title="Token not found"
          message={`No ${label} token with this id exists. Try another collection above. (${getErrorMessage(nft.error)})`}
        />
      ) : (
        <>
          <Card className="p-0">
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-t-xl bg-surface-2">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt={name} className="h-full w-full object-cover" />
              ) : (
                <span className="font-mono text-sm text-muted">No image</span>
              )}
            </div>
            {metadata.data?.description ? <p className="p-5 text-sm text-muted">{metadata.data.description}</p> : null}
          </Card>

          {metadata.data?.attributes && metadata.data.attributes.length > 0 ? (
            <Card>
              <CardHeader title="Attributes" />
              <DefinitionList
                items={metadata.data.attributes.map((attr) => ({
                  label: attr.trait_type ?? "Trait",
                  value: String(attr.value ?? "—"),
                }))}
              />
            </Card>
          ) : null}

          {nft.tokenURI ? (
            <Card>
              <CardHeader title="Metadata" />
              <a href={ipfsToHttp(nft.tokenURI)} target="_blank" rel="noreferrer noopener" className="break-all text-sm text-brand hover:underline">
                {nft.tokenURI}
              </a>
            </Card>
          ) : null}
        </>
      )}
    </DetailShell>
  );
}

export default function NftDetailPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading token…" />}>
      <NftDetailInner />
    </Suspense>
  );
}
