"use client";

import { useMemo } from "react";
import { getErrorMessage } from "@/lib/errors";
import { formatBps, formatTokenAmount } from "@/lib/format";
import { useFeeSchedule, type FeeCollection, type FeeRate } from "@/hooks/settlementFees";
import { useUsdc } from "@/hooks/useUsdc";
import { PageHeader } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { TxLink } from "@/components/ui/TxLink";
import { EmptyState } from "@/components/ui/States";
import { Bytes32Cell } from "@/components/t2/Bytes32Cell";
import { Money } from "@/components/t2/Money";
import { NotDeployedState } from "@/components/t2/NotDeployedState";

export default function FeesPage() {
  const { feeManagerAddress, rates, collections, isLoading, isError, error, refetch, deployed } = useFeeSchedule();
  const usdc = useUsdc();

  const stats = useMemo(() => {
    const collected = collections.reduce((s, c) => s + c.amount, 0n);
    const avgBps = rates.length > 0 ? Math.round(rates.reduce((s, r) => s + r.bps, 0) / rates.length) : 0;
    return { collected, actions: rates.length, avgBps, count: collections.length };
  }, [collections, rates]);

  const rateColumns: readonly Column<FeeRate>[] = [
    { id: "action", header: "Action key", cell: (r) => <Bytes32Cell value={r.action} lead={6} tail={6} /> },
    { id: "bps", header: "Rate", align: "right", cell: (r) => <span className="font-mono tabular-nums text-fg">{formatBps(r.bps)}</span> },
  ];

  const collectionColumns: readonly Column<FeeCollection>[] = [
    { id: "action", header: "Action", cell: (c) => <Bytes32Cell value={c.action} lead={5} tail={4} /> },
    {
      id: "payer",
      header: "Payer",
      className: "hidden md:table-cell",
      cell: (c) => (c.payer ? <AddressBadge address={c.payer} explorer={false} /> : <span className="text-faint">—</span>),
    },
    { id: "amount", header: "Fee", align: "right", cell: (c) => <Money amount={c.amount} decimals={usdc.decimals} symbol={usdc.symbol} /> },
    { id: "tx", header: "Tx", align: "right", cell: (c) => (c.txHash ? <TxLink hash={c.txHash} /> : <span className="text-faint">—</span>) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="fees"
        accentClassName="text-finance"
        title="Fees"
        subtitle="The protocol fee schedule by action, and every fee collected across the platform."
        breadcrumbs={[{ label: "Settlement" }, { label: "Fees" }]}
        actions={feeManagerAddress ? <AddressBadge address={feeManagerAddress} /> : null}
      />

      {!deployed ? (
        <NotDeployedState contract="FeeManager" />
      ) : (
        <>
          <KpiRow
            loading={isLoading}
            items={[
              { label: "Fees collected", value: `${formatTokenAmount(stats.collected, usdc.decimals)} ${usdc.symbol}`, hintTone: "brand" },
              { label: "Fee events", value: stats.count },
              { label: "Priced actions", value: stats.actions },
              { label: "Average rate", value: formatBps(stats.avgBps) },
            ]}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Fee schedule" description="Configured basis-point rate per action key." />
              {rates.length === 0 && !isLoading ? (
                <EmptyState title="No configured fees" description="No fee rates have been set yet." />
              ) : (
                <DataTable
                  columns={rateColumns}
                  rows={rates}
                  getRowKey={(r) => r.action}
                  isLoading={isLoading}
                  error={isError ? getErrorMessage(error) : null}
                  onRetry={() => void refetch()}
                  emptyTitle="No fees configured"
                />
              )}
            </Card>

            <Card>
              <CardHeader title="Recent collections" description="Fees taken, most recent first." />
              <DataTable
                columns={collectionColumns}
                rows={collections.slice(0, 20)}
                getRowKey={(c, i) => `${c.txHash ?? c.order}-${i}`}
                isLoading={isLoading}
                error={isError ? getErrorMessage(error) : null}
                onRetry={() => void refetch()}
                emptyTitle="No fees collected yet"
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
