"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/errors";
import { DealState, type DealStateValue } from "@/lib/types";
import { formatTokenAmount } from "@/lib/format";
import { useSettlementDeals, type SettlementDealRecord } from "@/hooks/settlementDeals";
import { useUsdc } from "@/hooks/useUsdc";
import { useTradeUrlState } from "@/hooks/tradeUrlState";
import { PageHeader, Toolbar, FilterBar } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { DataTable, type Column, type SortState } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Bytes32Cell } from "@/components/t2/Bytes32Cell";
import { DealStateBadge } from "@/components/t2/StateBadge";
import { Money } from "@/components/t2/Money";
import { NotDeployedState } from "@/components/t2/NotDeployedState";
import { SearchParamsBoundary } from "@/components/t2/SearchParamsBoundary";

const PAGE_SIZE = 12;

const STATE_OPTIONS = [
  { value: "", label: "All states" },
  { value: String(DealState.Funded), label: "Funded" },
  { value: String(DealState.Released), label: "Released" },
  { value: String(DealState.Disputed), label: "Disputed" },
  { value: String(DealState.Refunded), label: "Refunded" },
];

export default function DealsPage() {
  return (
    <SearchParamsBoundary>
      <DealsContent />
    </SearchParamsBoundary>
  );
}

function DealsContent() {
  const router = useRouter();
  const url = useTradeUrlState();
  const { deals, isLoading, isError, error, refetch, deployed } = useSettlementDeals();
  const usdc = useUsdc();

  const q = url.get("q").toLowerCase();
  const stateFilter = url.get("state");
  const sortId = url.get("sort") || "recent";
  const sortDir = (url.get("dir") || "desc") as "asc" | "desc";
  const page = Math.max(0, Number(url.get("page") || "0") || 0);

  const filtered = useMemo(() => {
    let rows = deals.slice();
    if (stateFilter) rows = rows.filter((d) => String(d.state) === stateFilter);
    if (q) {
      rows = rows.filter(
        (d) =>
          d.batchId.toLowerCase().includes(q) ||
          (d.buyer?.toLowerCase().includes(q) ?? false) ||
          (d.supplier?.toLowerCase().includes(q) ?? false),
      );
    }
    const factor = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (sortId === "amount") return a.amount < b.amount ? -factor : a.amount > b.amount ? factor : 0;
      return a.order < b.order ? -factor : a.order > b.order ? factor : 0;
    });
    return rows;
  }, [deals, stateFilter, q, sortId, sortDir]);

  const total = filtered.length;
  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const kpis = useMemo(() => {
    const funded = deals.filter((d) => d.state === DealState.Funded);
    const escrowed = funded.reduce((sum, d) => sum + d.amount, 0n);
    const settled = deals.filter((d) => d.state === DealState.Released).length;
    const disputed = deals.filter((d) => d.state === DealState.Disputed).length;
    return [
      { label: "Total deals", value: deals.length },
      { label: "In escrow", value: funded.length, hint: `${formatTokenAmount(escrowed, usdc.decimals)} ${usdc.symbol}` },
      { label: "Released", value: settled, hintTone: "success" as const, hint: "Settled to supplier" },
      { label: "Disputed", value: disputed, hintTone: disputed > 0 ? ("danger" as const) : ("neutral" as const), hint: "Under arbitration" },
    ];
  }, [deals, usdc.decimals, usdc.symbol]);

  const onSort = (next: SortState) => url.setMany({ sort: next.id, dir: next.dir, page: null });

  const columns: readonly Column<SettlementDealRecord>[] = [
    { id: "batchId", header: "Batch", cell: (d) => <Bytes32Cell value={d.batchId} href={`/deals/${d.batchId}`} /> },
    {
      id: "buyer",
      header: "Buyer",
      className: "hidden md:table-cell",
      cell: (d) => (d.buyer ? <AddressBadge address={d.buyer} explorer={false} /> : <span className="text-faint">—</span>),
    },
    {
      id: "supplier",
      header: "Supplier",
      className: "hidden lg:table-cell",
      cell: (d) => (d.supplier ? <AddressBadge address={d.supplier} explorer={false} /> : <span className="text-faint">—</span>),
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      cell: (d) => <Money amount={d.amount} decimals={usdc.decimals} symbol={usdc.symbol} />,
    },
    { id: "state", header: "State", align: "right", cell: (d) => <DealStateBadge state={d.state as DealStateValue} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="deals"
        accentClassName="text-finance"
        title="Deals"
        subtitle="Escrowed settlements between buyers and suppliers, released on passing attestation."
        breadcrumbs={[{ label: "Settlement" }, { label: "Deals" }]}
      />

      {!deployed ? (
        <NotDeployedState contract="SettlementEscrow" />
      ) : (
        <>
          <KpiRow items={kpis} loading={isLoading} />

          <Toolbar
            actions={
              <Select
                aria-label="Sort deals"
                options={[
                  { value: "recent", label: "Most recent" },
                  { value: "amount", label: "Amount" },
                ]}
                value={sortId}
                onChange={(e) => url.setMany({ sort: e.target.value, page: null })}
                className="w-40"
              />
            }
          >
            <FilterBar>
              <Input
                type="search"
                placeholder="Search batch, buyer or supplier…"
                aria-label="Search deals"
                defaultValue={url.get("q")}
                onChange={(e) => url.setMany({ q: e.target.value, page: null })}
                className="w-64"
              />
              <Select
                aria-label="Filter by state"
                options={STATE_OPTIONS}
                value={stateFilter}
                onChange={(e) => url.setMany({ state: e.target.value, page: null })}
                className="w-40"
              />
            </FilterBar>
          </Toolbar>

          <DataTable
            columns={columns}
            rows={paged}
            getRowKey={(d) => d.batchId}
            onRowClick={(d) => router.push(`/deals/${d.batchId}`)}
            isLoading={isLoading}
            error={isError ? getErrorMessage(error) : null}
            onRetry={() => void refetch()}
            sort={{ id: sortId, dir: sortDir }}
            onSortChange={onSort}
            emptyTitle={stateFilter || q ? "No matching deals" : "No deals yet"}
            emptyDescription={
              stateFilter || q ? "Adjust your filters to see more results." : "Funded escrow deals will appear here as buyers settle."
            }
          />

          <Pagination page={page} limit={PAGE_SIZE} total={total} onPageChange={(p) => url.set("page", p === 0 ? null : String(p))} />
        </>
      )}
    </div>
  );
}
