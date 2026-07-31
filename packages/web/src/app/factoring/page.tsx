"use client";

import { useMemo } from "react";
import { InvoiceListingState } from "@proofchain/shared";
import { getErrorMessage } from "@/lib/errors";
import { formatTokenAmount } from "@/lib/format";
import { openListings, isListingClosed } from "@/lib/finance";
import { useFinancingListings } from "@/hooks/useFinancingListings";
import { useUsdc } from "@/hooks/useUsdc";
import { useTradeUrlState } from "@/hooks/tradeUrlState";
import { PageHeader, Toolbar, FilterBar } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { CardGrid } from "@/components/ui/CardGrid";
import { Select } from "@/components/ui/Select";
import { Callout } from "@/components/ui/Callout";
import { ListingCard } from "@/components/finance/ListingCard";
import { NotDeployedState } from "@/components/t2/NotDeployedState";
import { SearchParamsBoundary } from "@/components/t2/SearchParamsBoundary";
import { getResolvedAddress } from "@/lib/shared";

const FILTERS = [
  { value: "available", label: "Available to factor" },
  { value: "factored", label: "Factored" },
  { value: "all", label: "All" },
];

export default function FactoringPage() {
  return (
    <SearchParamsBoundary>
      <FactoringContent />
    </SearchParamsBoundary>
  );
}

function FactoringContent() {
  const url = useTradeUrlState();
  const deployed = Boolean(getResolvedAddress("InvoiceFinancing"));
  const { listings, isLoading, isError, error, refetch } = useFinancingListings();
  const usdc = useUsdc();

  const filter = url.get("show", "available");

  const available = useMemo(() => openListings(listings), [listings]);
  const factored = useMemo(() => listings.filter((r) => r.state === InvoiceListingState.Funded), [listings]);

  const shown = useMemo(() => {
    if (filter === "available") return available;
    if (filter === "factored") return factored;
    return listings;
  }, [filter, available, factored, listings]);

  const availableVolume = useMemo(() => available.reduce((s, r) => s + (r.askAmount ?? 0n), 0n), [available]);
  const factoredVolume = useMemo(() => factored.reduce((s, r) => s + (r.askAmount ?? 0n), 0n), [factored]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="finance"
        accentClassName="text-finance"
        title="Factoring"
        subtitle="Sell an attested receivable outright for immediate working capital; the factor becomes the escrow payee."
        breadcrumbs={[{ label: "Trade Finance" }, { label: "Factoring" }]}
      />

      {!deployed ? (
        <NotDeployedState contract="InvoiceFinancing" />
      ) : (
        <>
          <KpiRow
            loading={isLoading}
            items={[
              { label: "Available to factor", value: available.length },
              { label: "Available volume", value: `${formatTokenAmount(availableVolume, usdc.decimals)} ${usdc.symbol}` },
              { label: "Factored", value: factored.length, hintTone: "brand" },
              { label: "Factored volume", value: `${formatTokenAmount(factoredVolume, usdc.decimals)} ${usdc.symbol}` },
            ]}
          />

          <Callout tone="info" title="How factoring works">
            A supplier lists an attested receivable at an ask price. A factor funds it upfront and is repaid the full face
            value when the underlying escrow settles. Manage listings from the{" "}
            <a href="/finance" className="text-brand hover:underline">financing marketplace</a>.
          </Callout>

          <Toolbar>
            <FilterBar>
              <Select
                aria-label="Filter receivables"
                options={FILTERS}
                value={filter}
                onChange={(e) => url.set("show", e.target.value === "available" ? null : e.target.value)}
                className="w-52"
              />
            </FilterBar>
          </Toolbar>

          <CardGrid
            items={shown}
            getKey={(record) => `${record.batchId}-${record.order}`}
            minColWidth={300}
            isLoading={isLoading}
            error={isError ? getErrorMessage(error) : null}
            onRetry={() => void refetch()}
            emptyTitle={filter === "available" ? "No receivables available" : "Nothing to show"}
            emptyDescription="Attested receivables listed for factoring will appear here."
            renderItem={(record) => (
              <ListingCard record={record} decimals={usdc.decimals} symbol={usdc.symbol} onChanged={() => void refetch()} />
            )}
          />

          {filter === "all" && shown.some((r) => isListingClosed(r.state)) ? (
            <p className="text-xs text-muted">Closed listings (claimed or cancelled) are shown for history.</p>
          ) : null}
        </>
      )}
    </div>
  );
}
