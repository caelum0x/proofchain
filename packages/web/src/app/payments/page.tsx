"use client";

import { useMemo } from "react";
import { getErrorMessage } from "@/lib/errors";
import { formatTokenAmount } from "@/lib/format";
import { usePaymentActivity, type PaymentRecord } from "@/hooks/settlementPayments";
import { useUsdc } from "@/hooks/useUsdc";
import { useTradeUrlState } from "@/hooks/tradeUrlState";
import { PageHeader, Toolbar, FilterBar } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Field";
import { Pagination } from "@/components/ui/Pagination";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { TxLink } from "@/components/ui/TxLink";
import { Bytes32Cell } from "@/components/t2/Bytes32Cell";
import { Money } from "@/components/t2/Money";
import { NotDeployedState } from "@/components/t2/NotDeployedState";
import { SearchParamsBoundary } from "@/components/t2/SearchParamsBoundary";

const PAGE_SIZE = 15;

export default function PaymentsPage() {
  return (
    <SearchParamsBoundary>
      <PaymentsContent />
    </SearchParamsBoundary>
  );
}

function PaymentsContent() {
  const url = useTradeUrlState();
  const { payments, isLoading, isError, error, refetch, deployed } = usePaymentActivity();
  const usdc = useUsdc();

  const q = url.get("q").toLowerCase();
  const page = Math.max(0, Number(url.get("page") || "0") || 0);

  const filtered = useMemo(
    () =>
      q
        ? payments.filter(
            (p) =>
              (p.payer?.toLowerCase().includes(q) ?? false) ||
              (p.destination?.toLowerCase().includes(q) ?? false) ||
              p.action.toLowerCase().includes(q),
          )
        : payments,
    [payments, q],
  );

  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const stats = useMemo(() => {
    const gross = payments.reduce((s, p) => s + p.amount, 0n);
    const fees = payments.reduce((s, p) => s + p.fee, 0n);
    const payers = new Set(payments.map((p) => p.payer?.toLowerCase()).filter(Boolean));
    return { count: payments.length, gross, fees, payers: payers.size };
  }, [payments]);

  const columns: readonly Column<PaymentRecord>[] = [
    { id: "action", header: "Action", cell: (p) => <Bytes32Cell value={p.action} lead={5} tail={4} /> },
    {
      id: "payer",
      header: "Payer",
      className: "hidden md:table-cell",
      cell: (p) => (p.payer ? <AddressBadge address={p.payer} explorer={false} /> : <span className="text-faint">—</span>),
    },
    {
      id: "destination",
      header: "Destination",
      className: "hidden lg:table-cell",
      cell: (p) => (p.destination ? <AddressBadge address={p.destination} explorer={false} /> : <span className="text-faint">—</span>),
    },
    { id: "amount", header: "Amount", align: "right", cell: (p) => <Money amount={p.amount} decimals={usdc.decimals} symbol={usdc.symbol} /> },
    { id: "fee", header: "Fee", align: "right", className: "hidden sm:table-cell", cell: (p) => <Money amount={p.fee} decimals={usdc.decimals} /> },
    {
      id: "tx",
      header: "Tx",
      align: "right",
      cell: (p) => (p.txHash ? <TxLink hash={p.txHash} /> : <span className="text-faint">—</span>),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="payments"
        accentClassName="text-finance"
        title="Payments"
        subtitle="Every payment routed through the protocol's PaymentRouter, with the fee taken on each."
        breadcrumbs={[{ label: "Settlement" }, { label: "Payments" }]}
      />

      {!deployed ? (
        <NotDeployedState contract="PaymentRouter" />
      ) : (
        <>
          <KpiRow
            loading={isLoading}
            items={[
              { label: "Payments", value: stats.count },
              { label: "Gross volume", value: `${formatTokenAmount(stats.gross, usdc.decimals)} ${usdc.symbol}` },
              { label: "Fees collected", value: `${formatTokenAmount(stats.fees, usdc.decimals)} ${usdc.symbol}`, hintTone: "brand", hint: "Protocol revenue" },
              { label: "Unique payers", value: stats.payers },
            ]}
          />

          <Toolbar>
            <FilterBar>
              <Input
                type="search"
                placeholder="Search payer, destination or action…"
                aria-label="Search payments"
                defaultValue={url.get("q")}
                onChange={(e) => url.setMany({ q: e.target.value, page: null })}
                className="w-72"
              />
            </FilterBar>
          </Toolbar>

          <DataTable
            columns={columns}
            rows={paged}
            getRowKey={(p, i) => `${p.txHash ?? p.action}-${i}`}
            isLoading={isLoading}
            error={isError ? getErrorMessage(error) : null}
            onRetry={() => void refetch()}
            emptyTitle={q ? "No matching payments" : "No payments yet"}
            emptyDescription={q ? "Adjust your search." : "Routed payments will appear here."}
          />

          <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onPageChange={(p) => url.set("page", p === 0 ? null : String(p))} />
        </>
      )}
    </div>
  );
}
