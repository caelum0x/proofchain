"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFinancingListings } from "@/hooks/useFinancingListings";
import { useUsdc } from "@/hooks/useUsdc";
import { ListingCard } from "@/components/finance/ListingCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { getResolvedAddress } from "@/lib/shared";
import { normalizeBytes32 } from "@/lib/hashing";
import { getErrorMessage } from "@/lib/errors";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="mt-1 text-sm text-muted">Receivable NFTs and their financing terms.</p>
      </div>

      <Card>
        <CardHeader title="Look up a receivable" description="Open the invoice detail for any batch id or reference." />
        <form noValidate onSubmit={onLookup} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Batch id or reference" htmlFor="inv-lookup" error={lookupError ?? undefined}>
              <Input id="inv-lookup" placeholder="0x… or reference" value={lookup} onChange={(e) => setLookup(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" className="mb-4 sm:mb-4">
            Open invoice
          </Button>
        </form>
      </Card>

      <h2 className="text-base font-semibold">Receivables in financing</h2>
      {!deployed ? (
        <EmptyState
          title="Financing is not available on this network"
          description="The InvoiceFinancing contract is not deployed for the configured chain."
        />
      ) : isLoading ? (
        <LoadingState label="Indexing receivables…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : listings.length === 0 ? (
        <EmptyState
          title="No receivables yet"
          description="List an attested receivable from the financing marketplace to see it here."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((record) => (
            <ListingCard
              key={`${record.batchId}-${record.order}`}
              record={record}
              decimals={usdc.decimals}
              symbol={usdc.symbol}
              onChanged={() => void refetch()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
