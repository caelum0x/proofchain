"use client";

import { useMemo } from "react";
import { getErrorMessage } from "@/lib/errors";
import { formatTokenAmount } from "@/lib/format";
import { useSupplierBonds, type BondEvent } from "@/hooks/financeBond";
import { useUsdc } from "@/hooks/useUsdc";
import { PageHeader } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { StatusBadge, type SemanticStatus } from "@/components/ui/StatusBadge";
import { TxLink } from "@/components/ui/TxLink";
import { Money } from "@/components/t2/Money";
import { NotDeployedState } from "@/components/t2/NotDeployedState";
import type { BondEventKind } from "@/hooks/financeBond";

const KIND_LABEL: Record<BondEventKind, string> = {
  deposited: "Posted",
  locked: "Guarantee locked",
  unlocked: "Released",
  slashed: "Slashed",
  withdrawn: "Withdrawn",
};

const KIND_TONE: Record<BondEventKind, SemanticStatus> = {
  deposited: "success",
  locked: "brand",
  unlocked: "neutral",
  slashed: "danger",
  withdrawn: "warn",
};

export default function GuaranteesPage() {
  const { positions, events, isLoading, isError, error, refetch, deployed } = useSupplierBonds();
  const usdc = useUsdc();

  const stats = useMemo(() => {
    const guaranteed = positions.reduce((s, p) => s + p.total, 0n);
    const active = positions.reduce((s, p) => s + p.locked, 0n);
    const slashed = events.filter((e) => e.kind === "slashed").length;
    return { issuers: positions.filter((p) => p.total > 0n).length, guaranteed, active, slashed };
  }, [positions, events]);

  const columns: readonly Column<BondEvent>[] = [
    {
      id: "kind",
      header: "Event",
      cell: (e) => <StatusBadge status={KIND_TONE[e.kind]}>{KIND_LABEL[e.kind]}</StatusBadge>,
    },
    { id: "supplier", header: "Guarantor", className: "hidden sm:table-cell", cell: (e) => <AddressBadge address={e.supplier} explorer={false} /> },
    { id: "amount", header: "Amount", align: "right", cell: (e) => <Money amount={e.amount} decimals={usdc.decimals} symbol={usdc.symbol} /> },
    { id: "tx", header: "Tx", align: "right", cell: (e) => (e.txHash ? <TxLink hash={e.txHash} /> : <span className="text-faint">—</span>) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="shield"
        accentClassName="text-finance"
        title="Guarantees"
        subtitle="Performance guarantees backed by supplier bonds — collateral locked against delivery obligations."
        breadcrumbs={[{ label: "Trade Finance" }, { label: "Guarantees" }]}
      />

      {!deployed ? (
        <NotDeployedState contract="SupplierBond" />
      ) : (
        <>
          <KpiRow
            loading={isLoading}
            items={[
              { label: "Guarantors", value: stats.issuers },
              { label: "Total guaranteed", value: `${formatTokenAmount(stats.guaranteed, usdc.decimals)} ${usdc.symbol}` },
              { label: "Active (locked)", value: `${formatTokenAmount(stats.active, usdc.decimals)} ${usdc.symbol}`, hintTone: "brand" },
              { label: "Slashing events", value: stats.slashed, hintTone: stats.slashed > 0 ? "danger" : "neutral" },
            ]}
          />

          <Card>
            <CardHeader title="Guarantee activity" description="Bond deposits, locks, releases and slashes." />
            <DataTable
              columns={columns}
              rows={events}
              getRowKey={(e, i) => `${e.txHash ?? e.order}-${i}`}
              isLoading={isLoading}
              error={isError ? getErrorMessage(error) : null}
              onRetry={() => void refetch()}
              emptyTitle="No guarantee activity"
              emptyDescription="Supplier bond movements will appear here."
            />
          </Card>
        </>
      )}
    </div>
  );
}
