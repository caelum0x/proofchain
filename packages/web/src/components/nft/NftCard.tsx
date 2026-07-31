"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { useNftMetadata } from "@/hooks/useNftMetadata";
import { ipfsToHttp } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { AddressLink } from "@/components/ui/TxLink";
import type { NftItem } from "@/hooks/useNfts";

/** Grid card for a single NFT: thumbnail (if any), name, owner, and a detail link. */
export function NftCard({ item }: { item: NftItem }) {
  const ref = tryContractRef(item.collection);
  const uriQuery = useReadContract({
    address: ref?.address,
    abi: ref?.abi,
    functionName: "tokenURI",
    args: [item.tokenId],
    query: { enabled: Boolean(ref) },
  });
  const metadata = useNftMetadata(uriQuery.data as string | undefined);

  const name = metadata.data?.name ?? `#${shortId(item.tokenId)}`;
  const image = metadata.data?.image ? ipfsToHttp(metadata.data.image) : undefined;

  return (
    <Link href={`/nft/${item.tokenId.toString()}?collection=${item.collection}`} className="group block">
      <Card className="h-full p-0 transition-colors group-hover:border-brand/50">
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-t-xl bg-surface-2">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={name} className="h-full w-full object-cover" />
          ) : (
            <span className="font-mono text-xs text-muted">#{shortId(item.tokenId)}</span>
          )}
        </div>
        <div className="p-4">
          <h3 className="truncate text-sm font-semibold">{name}</h3>
          <p className="mt-1 text-xs text-muted">
            Owner <AddressLink address={item.owner} />
          </p>
        </div>
      </Card>
    </Link>
  );
}

function shortId(tokenId: bigint): string {
  const s = tokenId.toString();
  return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}
