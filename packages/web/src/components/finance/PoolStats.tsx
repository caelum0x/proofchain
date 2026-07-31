"use client";

import { RISK_GRADE_LABELS } from "@proofchain/shared";
import { StatCard } from "@/components/ui/StatCard";
import { formatBps, formatTokenAmount } from "@/lib/format";
import type { PoolView } from "@/hooks/usePool";

/**
 * KPI row summarising a FinancingPool: total assets under management, idle
 * liquidity, capital utilisation, NAV per share, and the risk-grade cutoff.
 */
export function PoolStats({ pool }: { pool: PoolView }) {
  const loading = pool.isLoading;
  const grade = pool.maxGrade;
  const gradeLabel = RISK_GRADE_LABELS[grade] ?? String(grade);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Assets under mgmt"
        value={`${formatTokenAmount(pool.totalAssets, pool.assetDecimals)} ${pool.assetSymbol}`}
        loading={loading}
      />
      <StatCard
        label="Idle liquidity"
        value={`${formatTokenAmount(pool.totalLiquidity, pool.assetDecimals)} ${pool.assetSymbol}`}
        hint={`${formatTokenAmount(pool.deployedAssets, pool.assetDecimals)} ${pool.assetSymbol} deployed`}
        loading={loading}
      />
      <StatCard
        label="Utilisation"
        value={formatBps(pool.utilizationBps)}
        hint="Capital advanced into receivables"
        hintTone={pool.utilizationBps > 8000 ? "warn" : "neutral"}
        loading={loading}
      />
      <StatCard
        label="NAV / share"
        value={pool.navPerShare.toFixed(4)}
        hint={`Funds up to grade ${gradeLabel}`}
        hintTone="brand"
        loading={loading}
      />
    </div>
  );
}
