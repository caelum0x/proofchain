"use client";

import { useMemo } from "react";
import { getErrorMessage } from "@/lib/errors";
import { formatTokenAmount } from "@/lib/format";
import { openListings } from "@/lib/finance";
import { getResolvedAddress } from "@/lib/shared";
import { useFinancingListings } from "@/hooks/useFinancingListings";
import { useDiscountParams } from "@/hooks/financeDiscount";
import { useUsdc } from "@/hooks/useUsdc";
import { PageHeader } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { CardGrid } from "@/components/ui/CardGrid";
import { Card, CardHeader } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { ListingCard } from "@/components/finance/ListingCard";
import { DiscountQuoteCard } from "@/components/t2/DiscountQuoteCard";
import { NotDeployedState } from "@/components/t2/NotDeployedState";

export default function PoFinancingPage() {
  const deployed = Boolean(getResolvedAddress("InvoiceFinancing"));
  const { listings, isLoading, isError, error, refetch } = useFinancingListings();
  const params = useDiscountParams();
  const usdc = useUsdc();

  const available = useMemo(() => openListings(listings), [listings]);
  const volume = useMemo(() => available.reduce((s, r) => s + (r.askAmount ?? 0n), 0n), [available]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="finance"
        accentClassName="text-finance"
        title="PO financing"
        subtitle="Pre-shipment working capital advanced against confirmed purchase orders and attested receivables."
        breadcrumbs={[{ label: "Trade Finance" }, { label: "PO Financing" }]}
      />

      {!deployed ? (
        <NotDeployedState contract="InvoiceFinancing" />
      ) : (
        <>
          <KpiRow
            loading={isLoading}
            items={[
              { label: "Open PO advances", value: available.length },
              { label: "Requested volume", value: `${formatTokenAmount(volume, usdc.decimals)} ${usdc.symbol}` },
              { label: "Financed to date", value: listings.length },
            ]}
          />

          <Callout tone="info" title="Purchase-order financing">
            A supplier with a confirmed order lists the expected receivable; a financier advances a discounted amount now
            and is repaid in full on settlement. Pricing follows the same discount curve as early payment.
          </Callout>

          {params.deployed ? (
            <DiscountQuoteCard
              decimals={usdc.decimals}
              symbol={usdc.symbol}
              maxGrade={params.maxGrade}
              title="Advance estimator"
              description="Size a pre-shipment advance for a purchase order."
            />
          ) : null}

          <Card>
            <CardHeader title="Open advances" description="Attested receivables awaiting a financier." />
            <CardGrid
              items={available}
              getKey={(r) => `${r.batchId}-${r.order}`}
              minColWidth={300}
              isLoading={isLoading}
              error={isError ? getErrorMessage(error) : null}
              onRetry={() => void refetch()}
              emptyTitle="No open advances"
              emptyDescription="Confirmed purchase orders listed for financing will appear here."
              renderItem={(record) => (
                <ListingCard record={record} decimals={usdc.decimals} symbol={usdc.symbol} onChanged={() => void refetch()} />
              )}
            />
          </Card>
        </>
      )}
    </div>
  );
}
