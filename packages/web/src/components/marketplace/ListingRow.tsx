"use client";

import { useAccount, useReadContract } from "wagmi";
import type { Address } from "viem";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { getErrorMessage } from "@/lib/errors";
import { ASSET_KIND_LABEL, LISTING_STATUS_LABEL, ListingStatus, type ListingEvent } from "@/hooks/useMarketplace";
import { AddressLink } from "@/components/ui/TxLink";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ToneName } from "@/lib/format";

const STATUS_TONE: Record<number, ToneName> = {
  0: "neutral",
  1: "brand",
  2: "neutral",
  3: "success",
};

/** A listings-table row that reads live status and offers a cancel action. */
export function ListingRow({ listing }: { listing: ListingEvent }) {
  const { address: account } = useAccount();
  const registry = tryContractRef("ListingRegistry");
  const statusQuery = useReadContract({
    address: registry?.address,
    abi: registry?.abi,
    functionName: "listingOf",
    args: [listing.listingId],
    query: { enabled: Boolean(registry) },
  });
  const cancelTx = useTx({ successLabel: "Listing cancelled", onConfirmed: () => statusQuery.refetch() });

  const raw = statusQuery.data as { status?: number; seller?: Address; price?: bigint } | undefined;
  const status = raw?.status ?? undefined;
  const isSeller = Boolean(account && account.toLowerCase() === listing.seller.toLowerCase());
  const canCancel = isSeller && status === ListingStatus.Active;

  const onCancel = async () => {
    if (!registry) return;
    try {
      await cancelTx.submit({
        address: registry.address,
        abi: registry.abi,
        functionName: "cancelListing",
        args: [listing.listingId],
      });
    } catch (e) {
      cancelTx.reset();
      // Surface via toast inside useTx; keep row resilient.
      void getErrorMessage(e);
    }
  };

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="px-4 py-3 font-mono text-xs">#{listing.listingId.toString()}</td>
      <td className="px-4 py-3">{ASSET_KIND_LABEL[listing.kind] ?? "—"}</td>
      <td className="px-4 py-3">
        <AddressBadge address={listing.asset} /> <span className="text-xs text-muted">#{listing.assetId.toString()}</span>
      </td>
      <td className="px-4 py-3">
        <AddressLink address={listing.seller} />
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs">{listing.price.toString()}</td>
      <td className="px-4 py-3">
        {status !== undefined ? (
          <Badge tone={STATUS_TONE[status] ?? "neutral"}>{LISTING_STATUS_LABEL[status] ?? "—"}</Badge>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {canCancel ? (
          <Button size="sm" variant="danger" onClick={onCancel} loading={cancelTx.isBusy}>
            Cancel
          </Button>
        ) : null}
      </td>
    </tr>
  );
}
