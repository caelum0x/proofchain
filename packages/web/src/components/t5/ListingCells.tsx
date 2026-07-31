"use client";

import type { Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { useTx } from "@/hooks/useTx";
import { getErrorMessage } from "@/lib/errors";
import { LISTING_STATUS_LABEL, ListingStatus, type ListingEvent } from "@/hooks/useMarketplace";
import { StatusBadge, type SemanticStatus } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";

/**
 * Per-row live cells for the marketplace listings table. Each listing's status
 * is not carried by its creation log, so these cells read `listingOf` live —
 * kept as small components so they compose inside a `DataTable` column `cell`.
 */

const STATUS_TONE: Record<number, SemanticStatus> = {
  0: "neutral",
  1: "brand",
  2: "neutral",
  3: "success",
};

interface RawStatus {
  readonly status?: number;
  readonly seller?: Address;
  readonly price?: bigint;
}

function useListingStatus(listing: ListingEvent) {
  const registry = tryContractRef("ListingRegistry");
  const query = useReadContract({
    address: registry?.address,
    abi: registry?.abi,
    functionName: "listingOf",
    args: [listing.listingId],
    query: { enabled: Boolean(registry) },
  });
  const raw = query.data as RawStatus | undefined;
  return { registry, status: raw?.status, refetch: () => void query.refetch() };
}

export function ListingStatusCell({ listing }: { readonly listing: ListingEvent }) {
  const { status } = useListingStatus(listing);
  if (status === undefined) return <span className="text-muted">—</span>;
  return <StatusBadge status={STATUS_TONE[status] ?? "neutral"}>{LISTING_STATUS_LABEL[status] ?? "—"}</StatusBadge>;
}

export function ListingActionsCell({
  listing,
  onDone,
}: {
  readonly listing: ListingEvent;
  readonly onDone?: () => void;
}) {
  const { address: account } = useAccount();
  const { registry, status, refetch } = useListingStatus(listing);
  const cancelTx = useTx({
    successLabel: "Listing cancelled",
    onConfirmed: () => {
      refetch();
      onDone?.();
    },
  });

  const isSeller = Boolean(account && account.toLowerCase() === listing.seller.toLowerCase());
  const canCancel = isSeller && status === ListingStatus.Active;
  if (!canCancel) return null;

  const onCancel = async () => {
    if (!registry) return;
    try {
      await cancelTx.submit({
        address: registry.address,
        abi: registry.abi,
        functionName: "cancelListing",
        args: [listing.listingId],
      });
    } catch (error) {
      cancelTx.reset();
      void getErrorMessage(error);
    }
  };

  return (
    <Button size="sm" variant="danger" onClick={onCancel} loading={cancelTx.isBusy}>
      Cancel
    </Button>
  );
}
