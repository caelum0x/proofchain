"use client";

import { useAccount } from "wagmi";
import { PageHeader } from "@/components/page";
import { Callout, Card, CardHeader, KpiRow, Meter } from "@/components/ui";
import { useInsurancePool } from "@/hooks/useInsurancePool";
import { useInsuranceRiskPool } from "@/hooks/useInsuranceRiskPool";
import { useUsdc } from "@/hooks/useUsdc";
import { PoolCapitalForm } from "@/components/t3/PoolCapitalForm";
import { NotAvailable } from "@/components/t3/NotAvailable";
import { formatBps, formatTokenAmount } from "@/lib/format";

/** Insurance › Pools: capital position, backstop reserves, and provider actions. */
export default function InsurancePoolsPage() {
  const { isConnected } = useAccount();
  const pool = useInsurancePool();
  const riskPool = useInsuranceRiskPool();
  const usdc = useUsdc(pool.poolAddress);

  const fmt = (v: bigint) => `${formatTokenAmount(v, usdc.decimals)} ${usdc.symbol}`;
  const utilization = pool.reservedRatioBps / 100;

  return (
    <div className="space-y-6">
      <PageHeader
        icon="insurance"
        accentClassName="text-compliance"
        title="Insurance pools"
        subtitle="Underwriting capital, backstop reserves, and coverage utilization."
        breadcrumbs={[{ label: "Insurance", href: "/insurance" }, { label: "Pools" }]}
      />

      {!pool.poolAddress ? (
        <NotAvailable resource="Insurance pools" />
      ) : (
        <>
          <KpiRow
            items={[
              { label: "Total capital", value: fmt(pool.totalCapital), loading: pool.isLoading },
              { label: "Available", value: fmt(pool.availableCapital), hint: "unreserved", hintTone: "success", loading: pool.isLoading },
              { label: "Reserved", value: fmt(pool.reservedCapital), hint: "against cover", loading: pool.isLoading },
              {
                label: "Backstop reserves",
                value: riskPool.deployed ? fmt(riskPool.reserves) : "—",
                hint: "RiskPool",
                loading: riskPool.isLoading,
              },
            ]}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="space-y-4">
              <CardHeader title="Capital utilization" description="Share of pool capital reserved against active cover." />
              <Meter value={utilization} min={0} max={100} low={50} high={80} invert showValue label="Reserved" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Reserved ratio</span>
                <span className="font-mono font-semibold text-fg">{formatBps(pool.reservedRatioBps)}</span>
              </div>
              {pool.reservedRatioBps > 8000 ? (
                <Callout tone="warn" title="High utilization">
                  Most pool capital is reserved. New cover may be constrained until claims settle or more capital is supplied.
                </Callout>
              ) : null}
              <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted">Your supplied capital</span>
                <span className="font-mono font-semibold text-fg">{isConnected ? fmt(pool.userDeposit) : "—"}</span>
              </div>
            </Card>

            <PoolCapitalForm userDeposit={pool.userDeposit} onChanged={pool.refetch} />
          </div>

          <Card>
            <CardHeader title="How the pool works" description="Providers underwrite cover; claims draw down reserves." />
            <ul className="space-y-2 text-sm text-muted">
              <li>• Providers deposit stablecoin capital to back policies and earn premium.</li>
              <li>• When a policy is issued, coverage is reserved against available capital.</li>
              <li>• Approved claims pay out from the pool; the RiskPool tops up any shortfall.</li>
              <li>• Providers may withdraw unreserved capital at any time.</li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
