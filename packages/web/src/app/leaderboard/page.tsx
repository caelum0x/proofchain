"use client";

import { useMemo } from "react";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { getErrorMessage } from "@/lib/errors";
import { formatBps } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/States";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";

/**
 * Supplier leaderboard ranked by on-chain track record (pass rate, average AI
 * score, deal volume, disputes). Reads the supplier registry joined with the
 * reputation engine + score oracle.
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
      <div>
        <h1 className="text-2xl font-semibold">Leaderboard</h1>
        <p className="mt-1 text-sm text-muted">
          Top suppliers by verified track record across the network.
        </p>
      </div>

      {notDeployed ? (
        <EmptyState
          title="Registry not deployed"
          description="The SupplierRegistry contract is not deployed on the configured network."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Suppliers" value={summary.supplierCount} loading={isLoading} />
            <StatCard label="Settled deals" value={summary.totalDeals} loading={isLoading} />
            <StatCard
              label="Avg. pass rate"
              value={formatBps(summary.avgPass)}
              hint={summary.rankedCount > 0 ? `${summary.rankedCount} ranked` : "No settled deals"}
              loading={isLoading}
            />
          </div>

          <Card>
            <CardHeader title="Ranking" description="Ordered by pass rate, then score, then volume." />
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
