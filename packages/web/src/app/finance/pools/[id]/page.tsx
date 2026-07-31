"use client";

import { use } from "react";
import Link from "next/link";
import { isAddress, getAddress, type Address } from "viem";
import { usePool } from "@/hooks/usePool";
import { PoolStats } from "@/components/finance/PoolStats";
import { PoolActions } from "@/components/finance/PoolActions";
import { LenderPosition } from "@/components/finance/LenderPosition";
import { RequireWallet } from "@/components/RequireWallet";
import { Card, CardHeader } from "@/components/ui/Card";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { EmptyState } from "@/components/ui/States";
import { RISK_GRADE_LABELS } from "@proofchain/shared";

/**
 * Financing pool detail: live stats, the lender's position, and deposit /
 * withdraw actions. `id` is the pool contract address.
 */
export default function PoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const valid = isAddress(id);
  const poolId = valid ? (getAddress(id) as Address) : undefined;
  const pool = usePool(poolId);

  if (!valid) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState title="Invalid pool id" description="The pool id must be a valid contract address." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink />
      <div>
        <h1 className="text-2xl font-semibold">Financing pool</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted">
          <AddressBadge address={poolId as Address} />
        </p>
      </div>

      {!pool.poolAddress ? (
        <EmptyState title="Pool not found" description="No FinancingPool is deployed at this address on the configured chain." />
      ) : (
        <>
          <PoolStats pool={pool} />
          <div className="grid gap-6 lg:grid-cols-2">
            <LenderPosition pool={pool} />
            <Card>
              <CardHeader title="Eligibility" description="Receivables the pool will auto-fund." />
              <p className="text-sm text-fg/90">
                This pool advances against receivables graded{" "}
                <span className="font-semibold">
                  {RISK_GRADE_LABELS[pool.maxGrade] ?? pool.maxGrade}
                </span>{" "}
                or better. A pool manager allocates idle liquidity to eligible listings from the{" "}
                <Link href="/finance" className="text-brand hover:underline">marketplace</Link>.
              </p>
            </Card>
          </div>

          <RequireWallet>
            <PoolActions pool={pool} />
          </RequireWallet>
        </>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/finance/pools" className="text-sm text-brand hover:underline">
      ← All pools
    </Link>
  );
}
