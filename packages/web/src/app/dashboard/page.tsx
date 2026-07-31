"use client";

import { useMemo } from "react";
import Link from "next/link";
import { InvoiceListingState, PolicyState } from "@proofchain/shared";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useOverviewMetrics } from "@/hooks/overviewMetrics";
import { useFinancingListings } from "@/hooks/useFinancingListings";
import { usePolicies } from "@/hooks/usePolicies";
import { usePool } from "@/hooks/usePool";
import { formatBps, formatTokenAmount } from "@/lib/format";
import { ModuleStatus } from "@/components/dashboard/ModuleStatus";
import { PageHeader } from "@/components/page/PageHeader";
import { KpiRow, type Kpi } from "@/components/ui/KpiRow";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { DonutChart, BarChart, type SeriesPoint } from "@/components/ui/Charts";

/** Format an optional API metric that may be a string or number. */
function metric(value: string | number | undefined): string {
  if (value === undefined || value === null) return "—";
  return typeof value === "number" ? value.toLocaleString() : value;
}

/**
 * Overview → Dashboard. Blends backend analytics (when reachable) with live
 * on-chain metrics for provenance, verification, financing, and pool capital, so
 * it stays useful even if the indexer is offline. Rebuilt on the design system.
 */
export default function DashboardPage() {
  const { stats, health, apiError } = useAnalytics();
  const m = useOverviewMetrics();
  const { listings } = useFinancingListings();
  const { policies } = usePolicies();
  const pool = usePool();

  const openListings = useMemo(
    () => listings.filter((r) => r.state === InvoiceListingState.Listed).length,
    [listings],
  );
  const activePolicies = useMemo(
    () => policies.filter((p) => p.state === PolicyState.Active).length,
    [policies],
  );

  const apiOnline = health !== null && !apiError;

  const kpis: readonly Kpi[] = [
    { label: "Registered batches", value: m.batches, hint: `${m.checkpoints} checkpoints`, loading: m.isLoading },
    { label: "Attestations", value: m.attestations, hint: `${m.passed} passed`, hintTone: "success", loading: m.isLoading },
    { label: "Pass rate", value: m.attestations ? formatBps(m.passRateBps) : "—", hintTone: "brand", loading: m.isLoading },
    { label: "Pool TVL", value: `${formatTokenAmount(pool.totalAssets, pool.assetDecimals)} ${pool.assetSymbol}`, hint: `${formatBps(pool.utilizationBps)} utilised`, loading: pool.isLoading },
  ];

  const verdictSlices = [
    { label: "Passed", value: m.passed, colorClassName: "text-success" },
    { label: "Failed", value: m.failed, colorClassName: "text-danger" },
  ];

  const settlementBars: readonly SeriesPoint[] = [
    { x: "Funded", y: m.funded },
    { x: "Settled", y: m.released },
    { x: "Disputed", y: m.disputed },
    { x: "Refunded", y: m.refunded },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="dashboard"
        breadcrumbs={[{ label: "Overview" }, { label: "Dashboard" }]}
        title="Dashboard"
        subtitle="Network analytics across provenance, verification, financing, and risk."
        actions={
          <StatusBadge status={apiOnline ? "success" : "warn"}>
            {apiOnline ? "API live" : "On-chain only"}
          </StatusBadge>
        }
      />

      <KpiRow items={kpis} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Verification verdicts" description="Attestation outcomes vs the pass threshold." />
          {m.attestations === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No attestations yet.</p>
          ) : (
            <div className="flex items-center gap-6">
              <DonutChart slices={verdictSlices} ariaLabel="Pass vs fail attestations" />
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-success" />Passed <span className="font-mono text-fg">{m.passed}</span></li>
                <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-danger" />Failed <span className="font-mono text-fg">{m.failed}</span></li>
                <li className="text-muted">Avg score <span className="font-mono text-fg">{m.attestations ? formatBps(m.avgScoreBps) : "—"}</span></li>
              </ul>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Settlement lifecycle" description="Escrow events across the network." />
          <BarChart data={settlementBars} colorClassName="text-finance" height={160} ariaLabel="Settlement lifecycle counts" />
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs text-muted">
            {settlementBars.map((b) => (
              <div key={String(b.x)}>
                <p className="font-mono text-sm text-fg">{b.y}</p>
                <p>{b.x}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Network overview"
          description={apiOnline ? "Aggregated by the ProofChain indexer." : "Available when the analytics API is online."}
          action={health?.indexerBlock !== undefined ? <span className="text-xs text-muted">Indexer block {String(health.indexerBlock)}</span> : null}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total deals" value={metric(stats.totalDeals)} />
          <StatCard label="Value settled" value={metric(stats.totalValueSettled)} />
          <StatCard label="Total financed" value={metric(stats.totalFinanced)} hint={`${openListings} open listings`} hintTone="brand" />
          <StatCard label="Active policies" value={activePolicies} />
          <StatCard label="Suppliers" value={metric(stats.totalSuppliers)} />
          <StatCard label="Organizations" value={metric(stats.totalOrganizations)} />
          <StatCard label="Open disputes" value={metric(stats.openDisputes)} />
          <StatCard label="Carbon retired" value={metric(stats.carbonRetired)} />
        </div>
      </Card>

      <ModuleStatus />

      <div className="flex flex-wrap gap-2">
        <Link href="/explorer"><Button variant="secondary" size="sm">Explorer</Button></Link>
        <Link href="/analytics"><Button variant="secondary" size="sm">Analytics</Button></Link>
        <Link href="/activity"><Button variant="secondary" size="sm">Activity</Button></Link>
        <Link href="/verifier"><Button variant="secondary" size="sm">Verifier</Button></Link>
      </div>
    </div>
  );
}
