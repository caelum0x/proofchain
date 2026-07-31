"use client";

import Link from "next/link";
import { usePool } from "@/hooks/usePool";
import { PoolStats } from "@/components/finance/PoolStats";
import { PoolActions } from "@/components/finance/PoolActions";
import { LenderPosition } from "@/components/finance/LenderPosition";
import { RequireWallet } from "@/components/RequireWallet";
import { PageHeader } from "@/components/page";
import { NotDeployedState } from "@/components/t2/NotDeployedState";

/**
 * Lend page: deposit capital into the FinancingPool and earn yield as financed
 * receivables settle. Shows the lender's live position and pool health.
 */
export default function LendPage() {
  const pool = usePool();

  return (
    <div className="space-y-6">
      <PageHeader
        icon="finance"
        accentClassName="text-finance"
        title="Lend"
        subtitle="Deposit stablecoins into the financing pool and earn yield from receivable advances."
        breadcrumbs={[{ label: "Trade Finance" }, { label: "Lend" }]}
      />

      {!pool.poolAddress ? (
        <NotDeployedState contract="FinancingPool" />
      ) : (
        <>
          <PoolStats pool={pool} />
          <RequireWallet>
            <LenderPosition pool={pool} />
            <PoolActions pool={pool} />
          </RequireWallet>
          <p className="text-xs text-muted">
            Prefer to browse first? See the{" "}
            <Link href="/finance/pools" className="text-brand hover:underline">pool directory</Link> or the{" "}
            <Link href="/finance" className="text-brand hover:underline">marketplace</Link>.
          </p>
        </>
      )}
    </div>
  );
}
