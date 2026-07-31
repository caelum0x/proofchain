"use client";

import { useMemo } from "react";
import { InvoiceListingState } from "@proofchain/shared";
import { useFinancingListings } from "@/hooks/useFinancingListings";
import { useUsdc } from "@/hooks/useUsdc";
import { useTradeUrlState } from "@/hooks/tradeUrlState";
import { ListingCard } from "@/components/finance/ListingCard";
import { ListReceivableForm } from "@/components/finance/ListReceivableForm";
import { RequireWallet } from "@/components/RequireWallet";
import { PageHeader, Toolbar, FilterBar } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { CardGrid } from "@/components/ui/CardGrid";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getResolvedAddress } from "@/lib/shared";
import { formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { isListingClosed, openListings } from "@/lib/finance";
import { NotDeployedState } from "@/components/t2/NotDeployedState";
import { SearchParamsBoundary } from "@/components/t2/SearchParamsBoundary";

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "all", label: "All" },
];

export default function FinanceMarketplacePage() {
  return (
    <SearchParamsBoundary>
      <FinanceMarketplaceContent />
    </SearchParamsBoundary>
  );
}

function FinanceMarketplaceContent() {
  const url = useTradeUrlState();
  const deployed = Boolean(getResolvedAddress("InvoiceFinancing"));
  const { listings, isLoading, isError, error, refetch } = useFinancingListings();
  const usdc = useUsdc();

  const filter = url.get("show", "open");
  const open = useMemo(() => openListings(listings), [listings]);
  const shown = filter === "open" ? open : listings;

  const totalOpenAsk = useMemo(() => open.reduce((sum, r) => sum + (r.askAmount ?? 0n), 0n), [open]);
  const funded = listings.filter((r) => r.state === InvoiceListingState.Funded).length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon="marketplace"
        accentClassName="text-finance"
        title="Financing marketplace"
        subtitle="Suppliers list attested receivables; lenders advance capital and become the escrow payee."
        breadcrumbs={[{ label: "Trade Finance" }, { label: "Marketplace" }]}
        actions={<StatusBadge status="success">Live</StatusBadge>}
      />

      {!deployed ? (
        <NotDeployedState contract="InvoiceFinancing" />
      ) : (
        <>
          <KpiRow
            loading={isLoading}
            items={[
              { label: "Open listings", value: open.length },
              { label: "In financing", value: funded, hintTone: "brand" },
              { label: "Open ask volume", value: `${formatTokenAmount(totalOpenAsk, usdc.decimals)} ${usdc.symbol}` },
              { label: "Total listings", value: listings.length },
            ]}
          />

          <RequireWallet>
            <ListReceivableForm decimals={usdc.decimals} symbol={usdc.symbol} onListed={() => void refetch()} />
          </RequireWallet>

          <Card>
            <CardHeader
              title="Listings"
              action={
                <Toolbar>
                  <FilterBar>
                    <Select
                      aria-label="Filter listings"
                      options={FILTERS}
                      value={filter}
                      onChange={(e) => url.set("show", e.target.value === "open" ? null : e.target.value)}
                      className="w-32"
                    />
                  </FilterBar>
                </Toolbar>
              }
            />
            <CardGrid
              items={shown}
              getKey={(r) => `${r.batchId}-${r.order}`}
              minColWidth={300}
              isLoading={isLoading}
              error={isError ? getErrorMessage(error) : null}
              onRetry={() => void refetch()}
              emptyTitle={filter === "open" ? "No open listings" : "No listings yet"}
              emptyDescription="List an attested receivable above to offer it for financing."
              renderItem={(record) => (
                <ListingCard record={record} decimals={usdc.decimals} symbol={usdc.symbol} onChanged={() => void refetch()} />
              )}
            />
          </Card>

          {filter === "all" && shown.some((r) => isListingClosed(r.state)) ? (
            <p className="text-xs text-muted">Closed listings (claimed or cancelled) are shown for history.</p>
          ) : null}
        </>
      )}
    </div>
  );
}
