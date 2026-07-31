"use client";

import { use, type ReactNode } from "react";
import Link from "next/link";
import { isAddress, getAddress, type Address } from "viem";
import { RISK_GRADE_LABELS } from "@proofchain/shared";
import { formatBps, formatTokenAmount } from "@/lib/format";
import { usePool } from "@/hooks/usePool";
import { DetailShell } from "@/components/shells/DetailShell";
import { PageHeader } from "@/components/page/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Meter } from "@/components/ui/Meter";
import { EmptyState } from "@/components/ui/States";
import { RequireWallet } from "@/components/RequireWallet";
import { LenderPosition } from "@/components/finance/LenderPosition";
import { PoolActions } from "@/components/finance/PoolActions";
import { Money } from "@/components/t2/Money";
import { NotDeployedState } from "@/components/t2/NotDeployedState";

/**
 * Tranche detail: the vault share class of a securitization vehicle. `id` is the
 * vault (or pool) contract address; economics are read live from the pool.
 */
export default function TrancheDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const valid = isAddress(id);
  const addr = valid ? (getAddress(id) as Address) : undefined;
  // A single securitization vehicle is deployed; the routed id selects its vault
  // for display while economics are read live from the canonical pool.
  const view = usePool();

  const breadcrumbs = [
    { label: "Trade Finance" },
    { label: "Securitization", href: "/securitization" },
    { label: "Tranche" },
  ];

  if (!valid) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tranche" breadcrumbs={breadcrumbs} icon="finance" accentClassName="text-finance" />
        <EmptyState title="Invalid tranche id" description="A tranche id must be a valid contract address." />
      </div>
    );
  }

  if (!view.poolAddress) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tranche" breadcrumbs={breadcrumbs} icon="finance" accentClassName="text-finance" />
        <NotDeployedState contract="FinancingPool" />
      </div>
    );
  }

  const header = (
    <PageHeader
      icon="finance"
      accentClassName="text-finance"
      title="Note tranche"
      subtitle={addr ? <AddressBadge address={addr} /> : undefined}
      breadcrumbs={breadcrumbs}
      actions={<StatusBadge status="brand">NAV {view.navPerShare.toFixed(4)}</StatusBadge>}
    />
  );

  const rail = (
    <>
      <Card>
        <CardHeader title="Tranche terms" />
        <dl className="space-y-3 text-sm">
          <Row label="Share symbol">
            <span className="font-mono text-fg">{view.shareSymbol}</span>
          </Row>
          <Row label="NAV / note">
            <span className="font-mono text-fg">{view.navPerShare.toFixed(4)}</span>
          </Row>
          <Row label="Notes outstanding">
            <Money amount={view.totalShares} decimals={view.shareDecimals} />
          </Row>
          <Row label="Eligible grade">
            <span className="text-fg">{RISK_GRADE_LABELS[view.maxGrade] ?? view.maxGrade}</span>
          </Row>
        </dl>
      </Card>
      <RequireWallet>
        <LenderPosition pool={view} />
      </RequireWallet>
    </>
  );

  return (
    <DetailShell header={header} rail={rail}>
      <Card>
        <CardHeader title="Collateral" description="Assets backing this note tranche." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat label="Total collateral" value={`${formatTokenAmount(view.totalAssets, view.assetDecimals)} ${view.assetSymbol}`} />
          <Stat label="Idle liquidity" value={`${formatTokenAmount(view.totalLiquidity, view.assetDecimals)} ${view.assetSymbol}`} />
          <Stat label="Deployed into receivables" value={`${formatTokenAmount(view.deployedAssets, view.assetDecimals)} ${view.assetSymbol}`} />
          <Stat label="Utilisation" value={formatBps(view.utilizationBps)} />
        </div>
        <div className="mt-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-muted">Capital deployed</p>
          <Meter value={view.utilizationBps} max={10000} label={formatBps(view.utilizationBps)} />
        </div>
      </Card>

      <RequireWallet>
        <PoolActions pool={view} />
      </RequireWallet>

      <p className="text-xs text-muted">
        Back to <Link href="/securitization" className="text-brand hover:underline">securitization</Link>.
      </p>
    </DetailShell>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-right text-fg">{children}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-fg">{value}</p>
    </div>
  );
}
