"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { InvoiceListingState } from "@proofchain/shared";
import { useFinancingListings } from "@/hooks/useFinancingListings";
import { useUsdc } from "@/hooks/useUsdc";
import { ListingCard } from "@/components/finance/ListingCard";
import { PageHeader } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { Card, CardHeader } from "@/components/ui/Card";
import { CardGrid } from "@/components/ui/CardGrid";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { getResolvedAddress } from "@/lib/shared";
import { normalizeBytes32 } from "@/lib/hashing";
import { formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { NotDeployedState } from "@/components/t2/NotDeployedState";

/**
 * Invoices index: look up a receivable by batch id, or browse receivables that
 * have entered financing. Each links to its full invoice detail page.
 */
export default function InvoicesPage() {
  const router = useRouter();
  const deployed = Boolean(getResolvedAddress("InvoiceFinancing"));
  const { listings, isLoading, isError, error, refetch } = useFinancingListings();
  const usdc = useUsdc();
  const [lookup, setLookup] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);

  const onLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    const trimmed = lookup.trim();
    if (!trimmed) {
      setLookupError("Enter a batch id or reference.");
      return;
    }
    try {
      router.push(`/invoices/${normalizeBytes32(trimmed)}`);
    } catch (err) {
      setLookupError(getErrorMessage(err));
    }
  };

  const funded = useMemo(() => listings.filter((r) => r.state === InvoiceListingState.Funded), [listings]);
  const faceVolume = useMemo(() => listings.reduce((s, r) => s + (r.askAmount ?? 0n), 0n), [listings]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="finance"
        accentClassName="text-finance"
        title="Invoices"
        subtitle="Receivable NFTs and their financing terms."
        breadcrumbs={[{ label: "Trade Finance" }, { label: "Invoices" }]}
      />

      <Card>
        <CardHeader title="Look up a receivable" description="Open the invoice detail for any batch id or reference." />
        <form noValidate onSubmit={onLookup} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Batch id or reference" htmlFor="inv-lookup" error={lookupError ?? undefined}>
              <Input id="inv-lookup" placeholder="0x… or reference" value={lookup} onChange={(e) => setLookup(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" className="mb-4">
            Open invoice
          </Button>
        </form>
      </Card>

      {!deployed ? (
        <NotDeployedState contract="InvoiceFinancing" />
      ) : (
        <>
          <KpiRow
            loading={isLoading}
            items={[
              { label: "Receivables", value: listings.length },
              { label: "In financing", value: funded.length, hintTone: "brand" },
              { label: "Face volume", value: `${formatTokenAmount(faceVolume, usdc.decimals)} ${usdc.symbol}` },
            ]}
          />

          <Card>
            <CardHeader title="Receivables in financing" description="Listed receivables and their current state." />
            <CardGrid
              items={listings}
              getKey={(r) => `${r.batchId}-${r.order}`}
              minColWidth={300}
              isLoading={isLoading}
              error={isError ? getErrorMessage(error) : null}
              onRetry={() => void refetch()}
              emptyTitle="No receivables yet"
              emptyDescription="List an attested receivable from the financing marketplace to see it here."
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
