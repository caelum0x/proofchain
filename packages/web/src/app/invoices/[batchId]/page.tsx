"use client";

import { use } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import type { Hex } from "viem";
import { useBatchDetail } from "@/hooks/useBatchDetail";
import { useReceivable } from "@/hooks/useReceivable";
import { useUsdc } from "@/hooks/useUsdc";
import { ReceivableSummary } from "@/components/invoices/ReceivableSummary";
import { RegisterReceivableForm } from "@/components/invoices/RegisterReceivableForm";
import { InvoiceFinancingPanel } from "@/components/invoices/InvoiceFinancingPanel";
import { RequireWallet } from "@/components/RequireWallet";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { isBytes32 } from "@/lib/hashing";
import { getResolvedAddress } from "@/lib/shared";
import { shortenHex } from "@/lib/format";

/**
 * Invoice / receivable detail: provenance + attestation context, registered
 * terms, financing lifecycle actions, and the receivable NFT — all keyed by a
 * batch id (bytes32).
 */
export default function InvoiceDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId: raw } = use(params);
  const batchId = isBytes32(raw) ? (raw as Hex) : undefined;

  if (!batchId) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState title="Invalid batch id" description="An invoice id must be a 32-byte 0x… hex value." />
      </div>
    );
  }

  return <InvoiceDetail batchId={batchId} />;
}

function InvoiceDetail({ batchId }: { batchId: Hex }) {
  const { address: account } = useAccount();
  const detail = useBatchDetail(batchId);
  const supplier = detail.batch?.supplier;
  const receivable = useReceivable(batchId, supplier);
  const usdc = useUsdc();

  const deployed = Boolean(getResolvedAddress("InvoiceFinancing"));
  const isSupplier = Boolean(account && supplier && account.toLowerCase() === supplier.toLowerCase());
  const attested = Boolean(detail.attestation?.exists);
  const needsTerms = !receivable.terms;

  const onChanged = () => {
    detail.refetch();
    receivable.refetch();
  };

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{shortenHex(batchId, 8, 8)}</h1>
          {supplier ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted">
              Supplier <AddressBadge address={supplier} />
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          {attested ? <Badge tone="success">Attested</Badge> : <Badge tone="warn">Unattested</Badge>}
          {detail.deal ? <Badge tone="brand">Deal on-chain</Badge> : null}
        </div>
      </div>

      {detail.isLoading ? (
        <LoadingState label="Loading on-chain state…" />
      ) : !detail.batch ? (
        <EmptyState
          title="Batch not registered"
          description="This batch id has not been registered in the provenance registry."
          action={
            <Link href="/explorer" className="text-brand hover:underline">
              Browse registered batches
            </Link>
          }
        />
      ) : !deployed ? (
        <EmptyState
          title="Financing is not available on this network"
          description="The InvoiceFinancing contract is not deployed for the configured chain."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <ReceivableSummary
            receivable={receivable}
            attestationScore={detail.attestation?.score ?? null}
            decimals={usdc.decimals}
            symbol={usdc.symbol}
          />

          <div className="space-y-6">
            <InvoiceFinancingPanel
              batchId={batchId}
              listing={receivable.listing}
              isSupplier={isSupplier}
              attested={attested}
              decimals={usdc.decimals}
              symbol={usdc.symbol}
              claimQuote={receivable.claimQuote}
              onChanged={onChanged}
            />

            {needsTerms && isSupplier ? (
              <RequireWallet>
                <RegisterReceivableForm
                  batchId={batchId}
                  decimals={usdc.decimals}
                  symbol={usdc.symbol}
                  onRegistered={onChanged}
                />
              </RequireWallet>
            ) : null}

            <Card>
              <CardHeader title="Provenance" description="Checkpoints recorded for this batch." />
              <p className="text-sm text-fg/90">
                {detail.checkpoints.length} checkpoint{detail.checkpoints.length === 1 ? "" : "s"} recorded.{" "}
                <Link href={`/deals/${batchId}`} className="text-brand hover:underline">
                  View full timeline →
                </Link>
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/finance" className="text-sm text-brand hover:underline">
      ← Financing marketplace
    </Link>
  );
}
