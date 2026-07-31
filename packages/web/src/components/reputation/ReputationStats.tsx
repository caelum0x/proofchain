import { StatCard } from "@/components/ui/StatCard";
import { formatBps } from "@/lib/format";
import type { ReputationView } from "@/lib/directory";

/**
 * KPI grid summarising an address's on-chain reputation: total settled deals,
 * pass rate, average AI attestation score, and dispute count.
 */
export function ReputationStats({
  reputation,
  loading = false,
}: {
  reputation: ReputationView;
  loading?: boolean;
}) {
  const disputeRate =
    reputation.totalDeals > 0
      ? (reputation.disputes / reputation.totalDeals) * 100
      : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total deals" value={reputation.totalDeals} loading={loading} />
      <StatCard
        label="Pass rate"
        value={formatBps(reputation.passRateBps)}
        hint={reputation.totalDeals === 0 ? "No settled deals yet" : undefined}
        hintTone="neutral"
        loading={loading}
      />
      <StatCard
        label="Avg. score"
        value={formatBps(reputation.avgScoreBps)}
        loading={loading}
      />
      <StatCard
        label="Disputes"
        value={reputation.disputes}
        hint={reputation.totalDeals > 0 ? `${disputeRate.toFixed(1)}% of deals` : undefined}
        hintTone={reputation.disputes > 0 ? "danger" : "neutral"}
        loading={loading}
      />
    </div>
  );
}
