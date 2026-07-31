"use client";

import { useMemo } from "react";
import { getErrorMessage } from "@/lib/errors";
import { formatTokenAmount } from "@/lib/format";
import { useTreasury, type TreasuryFlow } from "@/hooks/settlementTreasury";
import { useUsdc } from "@/hooks/useUsdc";
import { PageHeader } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TxLink } from "@/components/ui/TxLink";
import { EmptyState } from "@/components/ui/States";
import { Money } from "@/components/t2/Money";
import { NotDeployedState } from "@/components/t2/NotDeployedState";

export default function TreasuryPage() {
  const { treasuryAddress, flows, balances, isLoading, isError, error, refetch, deployed } = useTreasury();
  const usdc = useUsdc();

  const stats = useMemo(() => {
    const inflow = flows.filter((f) => f.kind === "deposit").reduce((s, f) => s + f.amount, 0n);
    const outflow = flows.filter((f) => f.kind === "withdraw").reduce((s, f) => s + f.amount, 0n);
    const held = balances.reduce((s, b) => s + b.balance, 0n);
    return { inflow, outflow, held, tokens: balances.length };
  }, [flows, balances]);

  const flowColumns: readonly Column<TreasuryFlow>[] = [
    {
      id: "kind",
      header: "Type",
      cell: (f) => (
        <StatusBadge status={f.kind === "deposit" ? "success" : "warn"}>
          {f.kind === "deposit" ? "Deposit" : "Withdrawal"}
        </StatusBadge>
      ),
    },
    {
      id: "counterparty",
      header: "Counterparty",
      className: "hidden md:table-cell",
      cell: (f) => (f.counterparty ? <AddressBadge address={f.counterparty} explorer={false} /> : <span className="text-faint">—</span>),
    },
    {
      id: "token",
      header: "Token",
      className: "hidden lg:table-cell",
      cell: (f) => (f.token ? <AddressBadge address={f.token} explorer={false} /> : <span className="text-faint">—</span>),
    },
    { id: "amount", header: "Amount", align: "right", cell: (f) => <Money amount={f.amount} decimals={usdc.decimals} symbol={usdc.symbol} /> },
    { id: "tx", header: "Tx", align: "right", cell: (f) => (f.txHash ? <TxLink hash={f.txHash} /> : <span className="text-faint">—</span>) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="treasury"
        accentClassName="text-finance"
        title="Treasury"
        subtitle="Protocol-owned reserves: token balances and every deposit and withdrawal."
        breadcrumbs={[{ label: "Settlement" }, { label: "Treasury" }]}
        actions={treasuryAddress ? <AddressBadge address={treasuryAddress} /> : null}
      />

      {!deployed ? (
        <NotDeployedState contract="Treasury" />
      ) : (
        <>
          <KpiRow
            loading={isLoading}
            items={[
              { label: "Balance held", value: `${formatTokenAmount(stats.held, usdc.decimals)} ${usdc.symbol}`, hint: `${stats.tokens} token${stats.tokens === 1 ? "" : "s"}` },
              { label: "Total inflow", value: `${formatTokenAmount(stats.inflow, usdc.decimals)} ${usdc.symbol}`, hintTone: "success" },
              { label: "Total outflow", value: `${formatTokenAmount(stats.outflow, usdc.decimals)} ${usdc.symbol}`, hintTone: "warn" },
              { label: "Movements", value: flows.length },
            ]}
          />

          <Card>
            <CardHeader title="Balances by token" description="Current accounted holdings per asset." />
            {balances.length === 0 ? (
              <EmptyState title="No balances" description="The treasury holds no tokens yet." />
            ) : (
              <ul className="divide-y divide-border/60">
                {balances.map((b) => (
                  <li key={b.token} className="flex items-center justify-between py-3">
                    <AddressBadge address={b.token} />
                    <Money amount={b.balance} decimals={usdc.decimals} symbol={usdc.symbol} strong />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Movements" description="Deposits and withdrawals, most recent first." />
            <DataTable
              columns={flowColumns}
              rows={flows}
              getRowKey={(f, i) => `${f.txHash ?? f.order}-${i}`}
              isLoading={isLoading}
              error={isError ? getErrorMessage(error) : null}
              onRetry={() => void refetch()}
              emptyTitle="No movements yet"
              emptyDescription="Treasury deposits and withdrawals will appear here."
            />
          </Card>
        </>
      )}
    </div>
  );
}
