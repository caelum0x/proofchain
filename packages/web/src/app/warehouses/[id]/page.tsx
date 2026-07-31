"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { DetailShell } from "@/components/shells/DetailShell";
import { PageHeader } from "@/components/page";
import { AsyncBoundary } from "@/components/page/AsyncBoundary";
import { Card, CardHeader } from "@/components/ui/Card";
import { Timeline, type TimelineEvent } from "@/components/ui/Timeline";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TxButton } from "@/components/ui/TxButton";
import { Callout } from "@/components/ui/Callout";
import { tryContractRef } from "@/lib/contracts";
import { useWarehouseReceipt, useWarehouseReceipts } from "@/hooks/logisticsWarehouses";
import { getErrorMessage } from "@/lib/errors";
import { shortenHex } from "@/lib/format";

export default function WarehouseReceiptPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id ?? "";
  const tokenId = /^\d+$/.test(rawId) ? BigInt(rawId) : undefined;

  const { address } = useAccount();
  const { receipt, owner, notDeployed, isLoading, isError, error, refetch } = useWarehouseReceipt(tokenId);
  const list = useWarehouseReceipts();
  const ref = tryContractRef("WarehouseReceipt");

  const issued = useMemo(
    () => (tokenId !== undefined ? list.receipts.find((r) => r.tokenId === tokenId) : undefined),
    [list.receipts, tokenId],
  );

  const isOwner = Boolean(address && owner && address.toLowerCase() === owner.toLowerCase());
  const redeemed = receipt?.redeemed ?? false;

  const timeline: TimelineEvent[] = [
    {
      id: "issued",
      title: "Receipt issued",
      tone: "brand",
      timestamp: issued ? `#${issued.blockNumber.toString()}` : undefined,
      description: issued ? `${issued.quantity.toLocaleString()} units at ${issued.location}` : undefined,
    },
    ...(redeemed
      ? [{ id: "redeemed", title: "Receipt redeemed", tone: "success" as const, description: "Goods released; token burned/settled." }]
      : [{ id: "active", title: "Active", tone: "info" as const, description: "Redeemable by the current holder." }]),
  ];

  const rail = (
    <>
      <Card>
        <CardHeader title="Receipt" />
        <dl className="space-y-3 text-sm">
          <Row label="Token">#{tokenId?.toString() ?? "—"}</Row>
          <Row label="Status">
            {redeemed ? <StatusBadge status="neutral">Redeemed</StatusBadge> : <StatusBadge status="success">Active</StatusBadge>}
          </Row>
          <Row label="Batch">
            {receipt ? (
              <span className="inline-flex items-center gap-1 font-mono text-xs">
                {shortenHex(receipt.batchId, 6, 6)}
                <CopyButton value={receipt.batchId} />
              </span>
            ) : "—"}
          </Row>
          <Row label="Quantity">{receipt ? receipt.quantity.toLocaleString() : "—"}</Row>
          <Row label="Location">{receipt?.location || "—"}</Row>
          <Row label="Owner">{owner ? <AddressBadge address={owner} /> : "—"}</Row>
        </dl>
      </Card>

      {receipt && !redeemed ? (
        <Card>
          <CardHeader title="Actions" description={isOwner ? "You hold this receipt." : "Only the holder can redeem."} />
          {ref ? (
            <TxButton
              disabled={!isOwner}
              successLabel="Receipt redeemed"
              onConfirmed={() => { refetch(); list.refetch(); }}
              write={() => (tokenId === undefined ? null : { address: ref.address, abi: ref.abi, functionName: "redeem", args: [tokenId] })}
            >
              Redeem receipt
            </TxButton>
          ) : null}
          {!isOwner ? <p className="mt-2 text-xs text-muted">Connect the holder wallet to redeem.</p> : null}
        </Card>
      ) : null}
    </>
  );

  return (
    <DetailShell
      header={
        <PageHeader
          title={`Warehouse receipt #${tokenId?.toString() ?? ""}`}
          subtitle="Tokenized proof of stored goods."
          icon="warehouse"
          accentClassName="text-logistics"
          breadcrumbs={[
            { label: "Logistics", href: "/logistics" },
            { label: "Warehouses", href: "/warehouses" },
            { label: `#${tokenId?.toString() ?? "?"}` },
          ]}
        />
      }
      rail={rail}
    >
      {tokenId === undefined ? (
        <Callout tone="danger" title="Invalid receipt id">The receipt id must be a positive integer.</Callout>
      ) : notDeployed ? (
        <Callout tone="info" title="WarehouseReceipt not deployed">This registry is not configured on the active network.</Callout>
      ) : (
        <AsyncBoundary
          isLoading={isLoading}
          error={isError ? getErrorMessage(error) : null}
          onRetry={refetch}
          isEmpty={!receipt}
          emptyTitle="Receipt not found"
          emptyDescription="No warehouse receipt exists for this token id."
        >
          <Card>
            <CardHeader title="Lifecycle" />
            <Timeline events={timeline} />
          </Card>
          {receipt ? (
            <Card>
              <CardHeader title="Linked batch" description="The stored batch this receipt represents." />
              <Link href={`/freight/${receipt.batchId}`} className="text-brand hover:underline">
                View shipment {shortenHex(receipt.batchId, 6, 6)}
              </Link>
            </Card>
          ) : null}
        </AsyncBoundary>
      )}
    </DetailShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-right text-fg">{children}</dd>
    </div>
  );
}
