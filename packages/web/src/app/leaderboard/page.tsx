"use client";

import { useMemo } from "react";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { getErrorMessage } from "@/lib/errors";
import { formatBps } from "@/lib/format";
import { PageHeader, KpiRow } from "@/components/page";
import { Card, CardHeader } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";

/**
 * Supplier leaderboard (WD §3): ranked by on-chain track record (pass rate,
 * average AI score, deal volume, disputes) — the supplier registry joined with
 * the reputation engine + score oracle.
 */
export default function LeaderboardPage() {
  const { entries, isLoading, isError, error, notDeployed, refetch } = useLeaderboard();

  const summary = useMemo(() => {
    const ranked = entries.filter((e) => e.reputation.totalDeals > 0);
    const totalDeals = entries.reduce((sum, e) => sum + e.reputation.totalDeals, 0);
    const avgPass =
      ranked.length > 0
        ? ranked.reduce((sum, e) => sum + e.reputation.passRateBps, 0) / ranked.length
        : 0;
    return { supplierCount: entries.length, rankedCount: ranked.length, totalDeals, avgPass };
  }, [entries]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="leaderboard"
        title="Leaderboard"
        subtitle="Top suppliers by verified track record across the network."
        breadcrumbs={[{ label: "Identity" }, { label: "Leaderboard" }]}
      />

      {notDeployed ? (
        <Callout tone="warn" title="Registry not deployed">
          The SupplierRegistry contract is not deployed on the configured network.
        </Callout>
      ) : (
        <>
          <KpiRow
            items={[
              { label: "Suppliers", value: summary.supplierCount, loading: isLoading },
              { label: "Settled deals", value: summary.totalDeals, loading: isLoading },
              {
                label: "Avg. pass rate",
                value: formatBps(summary.avgPass),
                hint: summary.rankedCount > 0 ? `${summary.rankedCount} ranked` : "No settled deals",
                loading: isLoading,
              },
            ]}
          />

          <Card>
            <CardHeader
              title="Ranking"
              description="Ordered by pass rate, then score, then volume."
            />
            <LeaderboardTable
              entries={entries}
              isLoading={isLoading}
              isError={isError}
              error={isError ? getErrorMessage(error) : null}
              onRetry={refetch}
            />
          </Card>
        </>
      )}
    </div>
  );
}
