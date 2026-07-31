"use client";

import Link from "next/link";
import { RISK_GRADE_LABELS } from "@proofchain/shared";
import { formatBps, formatTokenAmount } from "@/lib/format";
import { usePool } from "@/hooks/usePool";
import { PageHeader } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Meter } from "@/components/ui/Meter";
import { Callout } from "@/components/ui/Callout";
import { NotDeployedState } from "@/components/t2/NotDeployedState";

export default function SecuritizationPage() {
  const pool = usePool();
  const vault = pool.vaultAddress;

  return (
    <div className="space-y-6">
      <PageHeader
        icon="finance"
        accentClassName="text-finance"
        title="Securitization"
        subtitle="Pooled receivables refinanced into transferable notes; lenders hold vault shares backed by the collateral pool."
        breadcrumbs={[{ label: "Trade Finance" }, { label: "Securitization" }]}
      />

      {!pool.poolAddress ? (
        <NotDeployedState contract="FinancingPool" />
      ) : (
        <>
          <KpiRow
            loading={pool.isLoading}
            items={[
              { label: "Collateral (TVL)", value: `${formatTokenAmount(pool.totalAssets, pool.assetDecimals)} ${pool.assetSymbol}` },
              { label: "Notes outstanding", value: `${formatTokenAmount(pool.totalShares, pool.shareDecimals)} ${pool.shareSymbol}` },
              { label: "NAV / note", value: pool.navPerShare.toFixed(4), hintTone: "brand" },
              { label: "Deployed", value: formatBps(pool.utilizationBps), hint: "Capital into receivables" },
            ]}
          />

          <Callout tone="info" title="Structure">
            The financing pool is the securitization vehicle: idle capital and advanced receivables form the collateral,
            and the ERC-4626 vault issues note shares whose NAV tracks the pool. Notes fund receivables up to grade{" "}
            <span className="font-semibold">{RISK_GRADE_LABELS[pool.maxGrade] ?? pool.maxGrade}</span>.
          </Callout>

          <Card>
            <CardHeader title="Note tranche" description="Vault share class backed by the collateral pool." />
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 text-sm">
                  <p className="flex items-center gap-2 text-muted">
                    Vault {vault ? <AddressBadge address={vault} /> : "—"}
                  </p>
                  <p className="text-muted">
                    Backing{" "}
                    <span className="font-mono font-medium text-fg">
                      {formatTokenAmount(pool.totalAssets, pool.assetDecimals)} {pool.assetSymbol}
                    </span>
                  </p>
                </div>
                {vault ? (
                  <Link href={`/tranches/${vault}`}>
                    <Button>View tranche</Button>
                  </Link>
                ) : null}
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-muted">Capital deployed</p>
                <Meter value={pool.utilizationBps} max={10000} label={formatBps(pool.utilizationBps)} />
              </div>
            </div>
          </Card>

          <p className="text-xs text-muted">
            Provide capital to a note tranche from{" "}
            <Link href="/finance/lend" className="text-brand hover:underline">Lend</Link>.
          </p>
        </>
      )}
    </div>
  );
}
