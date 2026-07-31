"use client";

import Link from "next/link";
import { usePool } from "@/hooks/usePool";
import { PoolStats } from "@/components/finance/PoolStats";
import { PageHeader } from "@/components/page";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { formatTokenAmount } from "@/lib/format";
import { NotDeployedState } from "@/components/t2/NotDeployedState";

/**
 * Directory of financing pools. A single canonical FinancingPool is deployed on
 * ProofChain; it is read live from chain here. Each pool links to its detail
 * page keyed by contract address.
 */
export default function PoolsPage() {
  const pool = usePool();

  return (
    <div className="space-y-6">
      <PageHeader
        icon="finance"
        accentClassName="text-finance"
        title="Financing pools"
        subtitle="Pooled lender capital that auto-funds eligible receivables by risk grade."
        breadcrumbs={[{ label: "Trade Finance" }, { label: "Pools" }]}
      />

      {!pool.poolAddress ? (
        <NotDeployedState contract="FinancingPool" />
      ) : (
        <>
          <PoolStats pool={pool} />

          <Card>
            <CardHeader title="ProofChain Financing Pool" description="ERC4626 vault backing receivable advances." />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1 text-sm">
                <p className="flex items-center gap-2 text-muted">
                  Pool <AddressBadge address={pool.poolAddress} />
                </p>
                <p className="text-muted">
                  TVL{" "}
                  <span className="font-medium text-fg">
                    {formatTokenAmount(pool.totalAssets, pool.assetDecimals)} {pool.assetSymbol}
                  </span>
                </p>
              </div>
              <Link href={`/finance/pools/${pool.poolAddress}`}>
                <Button>View pool</Button>
              </Link>
            </div>
          </Card>

          <p className="text-xs text-muted">
            Want to deposit directly? Head to <Link href="/finance/lend" className="text-brand hover:underline">Lend</Link>.
          </p>
        </>
      )}
    </div>
  );
}
