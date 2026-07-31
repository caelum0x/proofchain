"use client";

import { useBatches } from "@/hooks/useBatches";
import { BatchRow } from "@/components/verifier/BatchRow";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { getErrorMessage } from "@/lib/errors";
import { Badge } from "@/components/ui/Badge";

export default function VerifierPage() {
  const { batches, isLoading, isError, error, refetch } = useBatches();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Verifier dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Live provenance, attestation, and settlement state for every batch.
          </p>
        </div>
        <Badge tone="success">
          <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          Live
        </Badge>
      </div>

      {isLoading ? (
        <LoadingState label="Indexing batches from chain…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : batches.length === 0 ? (
        <EmptyState
          title="No batches registered yet"
          description="Register a batch from the Supplier screen to see it appear here in real time."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-3 font-medium">Batch</th>
                <th className="px-3 py-3 font-medium">Supplier</th>
                <th className="px-3 py-3 text-center font-medium">Checkpoints</th>
                <th className="px-3 py-3 font-medium">Attestation</th>
                <th className="px-3 py-3 font-medium">Settlement</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {batches.map((event) => (
                <BatchRow key={event.batchId} event={event} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
