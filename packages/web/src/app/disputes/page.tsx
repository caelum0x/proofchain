"use client";

import { useDisputedBatches } from "@/hooks/useDisputes";
import { DisputeRow } from "@/components/disputes/DisputeRow";
import { ArbiterPanel } from "@/components/disputes/ArbiterPanel";
import { RequireWallet } from "@/components/RequireWallet";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { getErrorMessage } from "@/lib/errors";

export default function DisputesPage() {
  const { items, isLoading, isError, error, refetch, notDeployed } = useDisputedBatches();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Disputes</h1>
          <p className="mt-1 text-sm text-muted">
            Deals the escrow flagged after a failing attestation. Staked arbiters vote to refund the
            buyer or release funds to the supplier.
          </p>
        </div>
        <Badge tone="warn">
          <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
          Live
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {notDeployed ? (
            <EmptyState
              title="Escrow not deployed"
              description="The SettlementEscrow contract is not configured on this network."
            />
          ) : isLoading ? (
            <LoadingState label="Scanning for disputed deals…" />
          ) : isError ? (
            <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
          ) : items.length === 0 ? (
            <EmptyState
              title="No disputed deals"
              description="When a shipment fails AI attestation, its escrow deal appears here for arbitration."
            />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Batch</th>
                    <th className="px-4 py-3 font-medium">Supplier</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Deal</th>
                    <th className="px-4 py-3 font-medium">Arbitration</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <DisputeRow key={item.batchId} batchId={item.batchId} score={item.score} />
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <div>
          <RequireWallet>
            <ArbiterPanel />
          </RequireWallet>
        </div>
      </div>
    </div>
  );
}
