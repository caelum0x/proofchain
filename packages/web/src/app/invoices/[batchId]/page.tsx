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
import { DetailShell } from "@/components/shells/DetailShell";
import { PageHeader } from "@/components/page/PageHeader";
import { AsyncBoundary } from "@/components/page/AsyncBoundary";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { EmptyState } from "@/components/ui/States";
import { isBytes32 } from "@/lib/hashing";
import { getResolvedAddress } from "@/lib/shared";
import { getErrorMessage } from "@/lib/errors";
import { Bytes32Cell } from "@/components/t2/Bytes32Cell";

/**
 * Invoice / receivable detail: provenance + attestation context, registered
 * terms, financing lifecycle actions, and the receivable NFT — all keyed by a
 * batch id (bytes32).
 */
export default function InvoiceDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId: raw } = use(params);
  const batchId = isBytes32(raw) ? (raw as Hex) : undefined;

  const breadcrumbs = [
    { label: "Trade Finance" },
    { label: "Invoices", href: "/invoices" },
    { label: "Detail" },
  ];

  if (!batchId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invoice" breadcrumbs={breadcrumbs} icon="finance" accentClassName="text-finance" />
        <EmptyState title="Invalid batch id" description="An invoice id must be a 32-byte 0x… hex value." />
      </div>
    );
  }

  return <InvoiceDetail batchId={batchId} breadcrumbs={breadcrumbs} />;
}

function InvoiceDetail({ batchId, breadcrumbs }: { batchId: Hex; breadcrumbs: { label: string; href?: string }[] }) {
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

  const header = (
    <PageHeader
      icon="finance"
      accentClassName="text-finance"
      title="Invoice"
      subtitle={<Bytes32Cell value={batchId} lead={8} tail={8} />}
      breadcrumbs={breadcrumbs}
      actions={
        <>
          {attested ? <StatusBadge status="success">Attested</StatusBadge> : <StatusBadge status="warn">Unattested</StatusBadge>}
          {detail.deal ? <StatusBadge status="brand">Deal on-chain</StatusBadge> : null}
        </>
      }
    />
  );

  const rail = (
    <>
      {supplier ? (
        <Card>
          <CardHeader title="Supplier" />
          <AddressBadge address={supplier} />
        </Card>
      ) : null}

      {deployed ? (
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
    </>
  );

  return (
    <DetailShell header={header} rail={rail}>
      <AsyncBoundary
        isLoading={detail.isLoading}
        error={detail.isError ? getErrorMessage(detail.error) : null}
        onRetry={() => detail.refetch()}
        isEmpty={!detail.batch}
        emptyTitle="Batch not registered"
        emptyDescription="This batch id has not been registered in the provenance registry."
        emptyAction={
          <Link href="/explorer" className="text-brand hover:underline">
            Browse registered batches
          </Link>
        }
      >
        {!deployed ? (
          <EmptyState
            title="Financing is not available on this network"
            description="The InvoiceFinancing contract is not deployed for the configured chain."
          />
        ) : (
          <>
            <ReceivableSummary
              receivable={receivable}
              attestationScore={detail.attestation?.score ?? null}
              decimals={usdc.decimals}
              symbol={usdc.symbol}
            />

            {needsTerms && isSupplier ? (
              <RequireWallet>
                <RegisterReceivableForm batchId={batchId} decimals={usdc.decimals} symbol={usdc.symbol} onRegistered={onChanged} />
              </RequireWallet>
            ) : null}
          </>
        )}
      </AsyncBoundary>
    </DetailShell>
  );
}
