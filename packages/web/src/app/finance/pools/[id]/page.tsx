"use client";

import { use } from "react";
import Link from "next/link";
import { isAddress, getAddress, type Address } from "viem";
import { usePool } from "@/hooks/usePool";
import { PoolStats } from "@/components/finance/PoolStats";
import { PoolActions } from "@/components/finance/PoolActions";
import { LenderPosition } from "@/components/finance/LenderPosition";
import { RequireWallet } from "@/components/RequireWallet";
import { PageHeader } from "@/components/page";
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

  const breadcrumbs = [
    { label: "Trade Finance" },
    { label: "Pools", href: "/finance/pools" },
    { label: "Pool" },
  ];

  if (!valid) {
    return (
      <div className="space-y-6">
        <PageHeader title="Financing pool" breadcrumbs={breadcrumbs} icon="finance" accentClassName="text-finance" />
        <EmptyState title="Invalid pool id" description="The pool id must be a valid contract address." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon="finance"
        accentClassName="text-finance"
        title="Financing pool"
        subtitle={<AddressBadge address={poolId as Address} />}
        breadcrumbs={breadcrumbs}
      />

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
