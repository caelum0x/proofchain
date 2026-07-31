"use client";

import { useDisputedBatches } from "@/hooks/useDisputes";
import { DisputeRow } from "@/components/disputes/DisputeRow";
import { ArbiterPanel } from "@/components/disputes/ArbiterPanel";
import { RequireWallet } from "@/components/RequireWallet";
import { PageHeader, KpiRow } from "@/components/page";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Callout } from "@/components/ui/Callout";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { getErrorMessage } from "@/lib/errors";

/**
 * Disputes queue (WD §3): deals the escrow flagged after a failing attestation.
 * Staked arbiters vote to refund the buyer or release funds to the supplier.
 */
export default function DisputesPage() {
  const { items, isLoading, isError, error, refetch, notDeployed } = useDisputedBatches();

  return (
    <div className="space-y-6">
      <PageHeader
        icon="disputes"
        title="Disputes"
        subtitle="Deals the escrow flagged after a failing attestation — staked arbiters vote to refund the buyer or release funds to the supplier."
        breadcrumbs={[{ label: "Governance" }, { label: "Disputes" }]}
        actions={
          <Badge tone="warn">
            <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
            Live
          </Badge>
        }
      />

      <KpiRow
        items={[
          { label: "Open disputes", value: items.length, loading: isLoading },
          { label: "Resolution", value: "Arbiter vote" },
          { label: "Outcome", value: "Refund / Release" },
        ]}
      />

      {notDeployed ? (
        <Callout tone="warn" title="Escrow not deployed">
          The SettlementEscrow contract is not configured on this network.
        </Callout>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {isLoading ? (
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
                  <thead className="border-b border-border bg-surface-2/80 text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Batch</th>
                      <th className="px-4 py-3 font-semibold">Supplier</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Score</th>
                      <th className="px-4 py-3 font-semibold">Deal</th>
                      <th className="px-4 py-3 font-semibold">Arbitration</th>
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
      )}
    </div>
  );
}
