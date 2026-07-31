"use client";

import { StatCard } from "@/components/ui/StatCard";
import { useNetworkStats } from "@/hooks/useNetworkStats";
import { formatTokenAmount } from "@/lib/format";
import type { NetworkStats } from "@/lib/api";

const USDC_DECIMALS = 6;

/** Format a count with thousands separators, or a dash when absent. */
function count(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString();
}

/**
 * Format a USDC-denominated value. Strings are treated as base units (6 dp);
 * numbers are treated as already-human whole-dollar amounts.
 */
function usd(value: NetworkStats["totalValueSettled"]): string {
  if (value === undefined) return "—";
  if (typeof value === "number") return `$${value.toLocaleString()}`;
  if (/^\d+$/.test(value)) {
    const human = formatTokenAmount(BigInt(value), USDC_DECIMALS, 2);
    return `$${human}`;
  }
  return "—";
}

/**
 * Live network statistics for the landing page. Fetches from the ProofChain API
 * and degrades gracefully: shows skeletons while loading and em-dash
 * placeholders (plus a quiet note) when the API is unreachable, so the marketing
 * page always renders.
 */
export function LiveStats() {
  const { stats, isLoading, isError } = useNetworkStats();

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Batches" value={count(stats?.totalBatches)} loading={isLoading} />
        <StatCard label="Escrow deals" value={count(stats?.totalDeals)} loading={isLoading} />
        <StatCard label="Suppliers" value={count(stats?.totalSuppliers)} loading={isLoading} />
        <StatCard label="Value settled" value={usd(stats?.totalValueSettled)} loading={isLoading} />
        <StatCard label="Financed" value={usd(stats?.totalFinanced)} loading={isLoading} />
        <StatCard label="Organizations" value={count(stats?.totalOrganizations)} loading={isLoading} />
        <StatCard label="Active policies" value={count(stats?.activePolicies)} loading={isLoading} />
        <StatCard label="Open disputes" value={count(stats?.openDisputes)} loading={isLoading} />
      </div>
      {isError ? (
        <p className="text-xs text-muted">
          Live stats are unavailable right now. Start the ProofChain API to populate this section.
        </p>
      ) : null}
    </div>
  );
}
