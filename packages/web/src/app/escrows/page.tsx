"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/errors";
import { DealState } from "@/lib/types";
import { formatTokenAmount } from "@/lib/format";
import { useSettlementDeals, type SettlementDealRecord } from "@/hooks/settlementDeals";
import { useUsdc } from "@/hooks/useUsdc";
import { useTradeUrlState } from "@/hooks/tradeUrlState";
import { PageHeader, Toolbar, FilterBar } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { Card, CardHeader } from "@/components/ui/Card";
import { DonutChart, type DonutSlice } from "@/components/ui/Charts";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/Select";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Bytes32Cell } from "@/components/t2/Bytes32Cell";
import { DealStateBadge } from "@/components/t2/StateBadge";
import { Money } from "@/components/t2/Money";
import { NotDeployedState } from "@/components/t2/NotDeployedState";
import { SearchParamsBoundary } from "@/components/t2/SearchParamsBoundary";

const STATE_OPTIONS = [
  { value: String(DealState.Funded), label: "Open (funded)" },
  { value: "all", label: "All escrows" },
  { value: String(DealState.Released), label: "Released" },
  { value: String(DealState.Disputed), label: "Disputed" },
  { value: String(DealState.Refunded), label: "Refunded" },
];

export default function EscrowsPage() {
  return (
    <SearchParamsBoundary>
      <EscrowsContent />
    </SearchParamsBoundary>
  );
}

function EscrowsContent() {
  const router = useRouter();
  const url = useTradeUrlState();
  const { deals, isLoading, isError, error, refetch, deployed } = useSettlementDeals();
  const usdc = useUsdc();

  const stateFilter = url.get("state", String(DealState.Funded));

  const rows = useMemo(
    () => (stateFilter === "all" ? deals : deals.filter((d) => String(d.state) === stateFilter)),
    [deals, stateFilter],
  );

  const stats = useMemo(() => {
    const funded = deals.filter((d) => d.state === DealState.Funded);
    const locked = funded.reduce((s, d) => s + d.amount, 0n);
    const avg = funded.length > 0 ? locked / BigInt(funded.length) : 0n;
    return {
      open: funded.length,
      locked,
      avg,
      disputed: deals.filter((d) => d.state === DealState.Disputed).length,
    };
  }, [deals]);

  const slices = useMemo<DonutSlice[]>(() => {
    const count = (s: number) => deals.filter((d) => d.state === s).length;
    return [
      { label: "Funded", value: count(DealState.Funded), colorClassName: "text-brand" },
      { label: "Released", value: count(DealState.Released), colorClassName: "text-success" },
      { label: "Disputed", value: count(DealState.Disputed), colorClassName: "text-danger" },
      { label: "Refunded", value: count(DealState.Refunded), colorClassName: "text-warn" },
    ].filter((s) => s.value > 0);
  }, [deals]);

  const columns: readonly Column<SettlementDealRecord>[] = [
    { id: "batchId", header: "Escrow (batch)", cell: (d) => <Bytes32Cell value={d.batchId} href={`/deals/${d.batchId}`} /> },
    {
      id: "buyer",
      header: "Depositor",
      className: "hidden md:table-cell",
      cell: (d) => (d.buyer ? <AddressBadge address={d.buyer} explorer={false} /> : <span className="text-faint">—</span>),
    },
    {
      id: "payee",
      header: "Payee",
      className: "hidden lg:table-cell",
      cell: (d) =>
        d.payee ? (
          <AddressBadge address={d.payee} explorer={false} />
        ) : d.supplier ? (
          <AddressBadge address={d.supplier} explorer={false} />
        ) : (
          <span className="text-faint">—</span>
        ),
    },
    { id: "amount", header: "Locked", align: "right", cell: (d) => <Money amount={d.amount} decimals={usdc.decimals} symbol={usdc.symbol} /> },
    { id: "state", header: "State", align: "right", cell: (d) => <DealStateBadge state={d.state} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="escrow"
        accentClassName="text-finance"
        title="Escrows"
        subtitle="On-chain escrow accounts holding buyer funds until settlement conditions are met."
        breadcrumbs={[{ label: "Settlement" }, { label: "Escrows" }]}
      />

      {!deployed ? (
        <NotDeployedState contract="SettlementEscrow" />
      ) : (
        <>
          <KpiRow
            loading={isLoading}
            items={[
              { label: "Open escrows", value: stats.open },
              { label: "Value locked", value: `${formatTokenAmount(stats.locked, usdc.decimals)} ${usdc.symbol}`, hint: "Across funded escrows" },
              { label: "Average size", value: `${formatTokenAmount(stats.avg, usdc.decimals)} ${usdc.symbol}` },
              { label: "Disputed", value: stats.disputed, hintTone: stats.disputed > 0 ? "danger" : "neutral", hint: "Held for arbitration" },
            ]}
          />

          <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
            <Card>
              <CardHeader title="Escrow states" description="Lifecycle distribution." />
              {slices.length > 0 ? (
                <div className="flex flex-wrap items-center gap-6">
                  <DonutChart slices={slices} ariaLabel="Escrow state distribution" />
                  <ul className="space-y-1.5 text-sm">
                    {slices.map((s) => (
                      <li key={s.label} className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full bg-current ${s.colorClassName}`} aria-hidden />
                        <span className="text-muted">{s.label}</span>
                        <span className="ml-auto font-mono tabular-nums text-fg">{s.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted">No escrow activity to chart yet.</p>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Escrow accounts"
                action={
                  <Toolbar>
                    <FilterBar>
                      <Select
                        aria-label="Filter escrows by state"
                        options={STATE_OPTIONS}
                        value={stateFilter}
                        onChange={(e) => url.set("state", e.target.value === String(DealState.Funded) ? null : e.target.value)}
                        className="w-44"
                      />
                    </FilterBar>
                  </Toolbar>
                }
              />
              <DataTable
                columns={columns}
                rows={rows}
                getRowKey={(d) => d.batchId}
                onRowClick={(d) => router.push(`/deals/${d.batchId}`)}
                isLoading={isLoading}
                error={isError ? getErrorMessage(error) : null}
                onRetry={() => void refetch()}
                emptyTitle="No escrows"
                emptyDescription="Funded escrow accounts will appear here."
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
