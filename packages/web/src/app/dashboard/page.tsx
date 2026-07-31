"use client";

import { useMemo } from "react";
import Link from "next/link";
import { InvoiceListingState, PolicyState } from "@proofchain/shared";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useBatches } from "@/hooks/useBatches";
import { useFinancingListings } from "@/hooks/useFinancingListings";
import { usePolicies } from "@/hooks/usePolicies";
import { usePool } from "@/hooks/usePool";
import { ModuleStatus } from "@/components/dashboard/ModuleStatus";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatBps, formatTokenAmount } from "@/lib/format";

/** Format an optional API metric that may be a string or number. */
function metric(value: string | number | undefined): string {
  if (value === undefined || value === null) return "—";
  return typeof value === "number" ? value.toLocaleString() : value;
}

/**
 * Network analytics dashboard. Blends backend analytics (when the API is
 * reachable) with live on-chain metrics for provenance, financing, insurance,
 * and pool capital, so it stays useful even if the indexer is offline.
 */
export default function DashboardPage() {
  const { stats, health, apiError } = useAnalytics();
  const batches = useBatches();
  const { listings } = useFinancingListings();
  const { policies } = usePolicies();
  const pool = usePool();

  const openListings = useMemo(
    () => listings.filter((r) => r.state === InvoiceListingState.Listed).length,
    [listings],
  );
  const inFinancing = useMemo(
    () => listings.filter((r) => r.state === InvoiceListingState.Funded).length,
    [listings],
  );
  const activePolicies = useMemo(
    () => policies.filter((p) => p.state === PolicyState.Active).length,
    [policies],
  );

  const apiOnline = health !== null && !apiError;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Network analytics across provenance, financing, and risk.</p>
        </div>
        <Badge tone={apiOnline ? "success" : "warn"}>
          <span
            className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${apiOnline ? "animate-pulse bg-success" : "bg-warn"}`}
          />
          {apiOnline ? "API live" : "On-chain only"}
        </Badge>
      </div>

      {!apiOnline ? (
        <p className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
          Backend analytics API is unreachable — showing live on-chain metrics only.
        </p>
      ) : null}

      {/* On-chain live metrics (always available) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registered batches" value={batches.batches.length} loading={batches.isLoading} />
        <StatCard
          label="Open financing"
          value={openListings}
          hint={`${inFinancing} in financing`}
          hintTone="brand"
        />
        <StatCard label="Active policies" value={activePolicies} />
        <StatCard
          label="Pool TVL"
          value={`${formatTokenAmount(pool.totalAssets, pool.assetDecimals)} ${pool.assetSymbol}`}
          hint={`${formatBps(pool.utilizationBps)} utilised`}
          loading={pool.isLoading}
        />
      </div>

      {/* Backend-sourced network stats */}
      <Card>
        <CardHeader
          title="Network overview"
          description={apiOnline ? "Aggregated by the ProofChain indexer." : "Available when the analytics API is online."}
          action={
            health?.indexerBlock !== undefined ? (
              <span className="text-xs text-muted">Indexer block {String(health.indexerBlock)}</span>
            ) : null
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total deals" value={metric(stats.totalDeals)} />
          <StatCard label="Value settled" value={metric(stats.totalValueSettled)} />
          <StatCard label="Total financed" value={metric(stats.totalFinanced)} />
          <StatCard
            label="Pass rate"
            value={stats.passRateBps !== undefined ? formatBps(stats.passRateBps) : "—"}
            hintTone="success"
          />
          <StatCard label="Suppliers" value={metric(stats.totalSuppliers)} />
          <StatCard label="Organizations" value={metric(stats.totalOrganizations)} />
          <StatCard label="Open disputes" value={metric(stats.openDisputes)} />
          <StatCard label="Carbon retired" value={metric(stats.carbonRetired)} />
        </div>
      </Card>

      <ModuleStatus />

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/finance" className="text-brand hover:underline">Financing marketplace →</Link>
        <Link href="/finance/lend" className="text-brand hover:underline">Lend →</Link>
        <Link href="/insurance" className="text-brand hover:underline">Insurance →</Link>
        <Link href="/verifier" className="text-brand hover:underline">Verifier →</Link>
      </div>
    </div>
  );
}
