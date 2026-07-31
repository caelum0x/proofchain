"use client";

import { useMemo } from "react";
import { getErrorMessage } from "@/lib/errors";
import { formatBps, formatTokenAmount } from "@/lib/format";
import { utilizationBps } from "@/lib/finance";
import { useSupplierBonds, type BondPosition } from "@/hooks/financeBond";
import { useUsdc } from "@/hooks/useUsdc";
import { PageHeader } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Meter } from "@/components/ui/Meter";
import { Callout } from "@/components/ui/Callout";
import { Money } from "@/components/t2/Money";
import { NotDeployedState } from "@/components/t2/NotDeployedState";

export default function CreditLinesPage() {
  const { positions, isLoading, isError, error, refetch, deployed } = useSupplierBonds();
  const usdc = useUsdc();

  const stats = useMemo(() => {
    const posted = positions.reduce((s, p) => s + p.total, 0n);
    const drawn = positions.reduce((s, p) => s + p.locked, 0n);
    const available = positions.reduce((s, p) => s + p.unlocked, 0n);
    const active = positions.filter((p) => p.total > 0n).length;
    return { posted, drawn, available, active };
  }, [positions]);

  const columns: readonly Column<BondPosition>[] = [
    { id: "supplier", header: "Borrower", cell: (p) => <AddressBadge address={p.supplier} explorer={false} /> },
    { id: "posted", header: "Collateral", align: "right", cell: (p) => <Money amount={p.total} decimals={usdc.decimals} symbol={usdc.symbol} /> },
    { id: "drawn", header: "Drawn", align: "right", className: "hidden sm:table-cell", cell: (p) => <Money amount={p.locked} decimals={usdc.decimals} /> },
    { id: "available", header: "Available", align: "right", className: "hidden md:table-cell", cell: (p) => <Money amount={p.unlocked} decimals={usdc.decimals} /> },
    {
      id: "utilization",
      header: "Utilisation",
      align: "right",
      cell: (p) => {
        const bps = utilizationBps(p.locked, p.total);
        return (
          <div className="ml-auto w-28">
            <Meter value={bps} max={10000} label={formatBps(bps)} />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="bonds"
        accentClassName="text-finance"
        title="Credit lines"
        subtitle="Collateral-backed borrowing capacity: each supplier's posted bond is a revolving credit line."
        breadcrumbs={[{ label: "Trade Finance" }, { label: "Credit Lines" }]}
      />

      {!deployed ? (
        <NotDeployedState contract="SupplierBond" />
      ) : (
        <>
          <KpiRow
            loading={isLoading}
            items={[
              { label: "Collateral posted", value: `${formatTokenAmount(stats.posted, usdc.decimals)} ${usdc.symbol}` },
              { label: "Drawn", value: `${formatTokenAmount(stats.drawn, usdc.decimals)} ${usdc.symbol}`, hintTone: "warn" },
              { label: "Available", value: `${formatTokenAmount(stats.available, usdc.decimals)} ${usdc.symbol}`, hintTone: "success" },
              { label: "Active lines", value: stats.active },
            ]}
          />

          <Callout tone="info" title="How credit lines are secured">
            Each supplier posts a bond as collateral. The locked portion backs live obligations (drawn); the unlocked
            portion is available headroom. Utilisation shows how much of the line is currently committed.
          </Callout>

          <Card>
            <CardHeader title="Credit lines" description="One line per bonded supplier." />
            <DataTable
              columns={columns}
              rows={positions}
              getRowKey={(p) => p.supplier}
              isLoading={isLoading}
              error={isError ? getErrorMessage(error) : null}
              onRetry={() => void refetch()}
              emptyTitle="No credit lines"
              emptyDescription="Suppliers who post a bond will appear here with their available capacity."
            />
          </Card>
        </>
      )}
    </div>
  );
}
