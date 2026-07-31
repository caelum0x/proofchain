"use client";

import { Suspense, useMemo } from "react";
import { useOrders, OrderSide, type OrderEvent } from "@/hooks/useMarketplace";
import { useListParams } from "@/hooks/t5-useListParams";
import { ResourceListView } from "@/components/t5/ResourceListView";
import { SearchInput, SelectFilter, ExportButton } from "@/components/t5/Filters";
import { applyTableState, compareBigint, type Comparator } from "@/components/t5/table-utils";
import { fmtNumber } from "@/components/t5/format";
import { PlaceOrderForm } from "@/components/marketplace/PlaceOrderForm";
import { RequireWallet } from "@/components/RequireWallet";
import { DataTable, type Column, type SortState } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { EmptyState, LoadingState } from "@/components/ui/States";

const SIDE_OPTIONS = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
];

const comparators: Readonly<Record<string, Comparator<OrderEvent>>> = {
  orderId: (a, b) => compareBigint(a.orderId, b.orderId),
  price: (a, b) => compareBigint(a.price, b.price),
  quantity: (a, b) => compareBigint(a.quantity, b.quantity),
};

function OrderBookInner() {
  const params = useListParams({ facets: ["side"], defaultSort: "orderId" });
  const side = params.facet("side");
  const { orders, isLoading, isError, error, refetch, notDeployed } = useOrders();

  const filtered = useMemo(() => {
    if (!side) return orders;
    const want = side === "buy" ? OrderSide.Buy : OrderSide.Sell;
    return orders.filter((o) => o.side === want);
  }, [orders, side]);

  const { rows, total } = useMemo(
    () =>
      applyTableState({
        rows: filtered,
        q: params.q,
        search: (o) => `${o.orderId} ${o.asset} ${o.maker} ${o.price}`,
        sortId: params.sortId,
        sortDir: params.sortDir,
        comparators,
        page: params.page,
        limit: params.limit,
      }),
    [filtered, params.q, params.sortId, params.sortDir, params.page, params.limit],
  );

  const columns = useMemo<readonly Column<OrderEvent>[]>(
    () => [
      { id: "orderId", header: "#", sortable: true, cell: (o) => <span className="font-mono text-xs text-muted">{o.orderId.toString()}</span> },
      {
        id: "side",
        header: "Side",
        cell: (o) => <StatusBadge status={o.side === OrderSide.Buy ? "success" : "danger"}>{o.side === OrderSide.Buy ? "Buy" : "Sell"}</StatusBadge>,
      },
      { id: "asset", header: "Asset", cell: (o) => <AddressBadge address={o.asset} /> },
      { id: "maker", header: "Maker", cell: (o) => <AddressBadge address={o.maker} /> },
      { id: "price", header: "Price", align: "right", sortable: true, cell: (o) => <span className="font-mono">{o.price.toString()}</span> },
      { id: "quantity", header: "Qty", align: "right", sortable: true, cell: (o) => <span className="font-mono">{o.quantity.toString()}</span> },
    ],
    [],
  );

  const sort: SortState | null = params.sortId ? { id: params.sortId, dir: params.sortDir } : null;
  const buys = orders.filter((o) => o.side === OrderSide.Buy).length;

  return (
    <ResourceListView
      title="Order book"
      subtitle="Open limit orders for fungible tokenized units, posted to the on-chain OrderBook."
      breadcrumbs={[{ label: "Markets" }, { label: "Order book" }]}
      icon="orderbook"
      accentClassName="text-markets"
      kpis={[
        { label: "Open orders", value: fmtNumber(orders.length) },
        { label: "Bids", value: fmtNumber(buys), hintTone: "success" },
        { label: "Asks", value: fmtNumber(orders.length - buys), hintTone: "danger" },
        { label: "Assets", value: fmtNumber(new Set(orders.map((o) => o.asset)).size) },
      ]}
      kpisLoading={isLoading}
      toolbar={
        <>
          <SearchInput value={params.q} onChange={params.setQ} placeholder="Search asset or maker" />
          <SelectFilter label="Side" value={side} onChange={(v) => params.setFacet("side", v || null)} options={SIDE_OPTIONS} />
        </>
      }
      toolbarActions={
        <ExportButton
          filename="order-book.csv"
          disabled={rows.length === 0}
          getCsv={() =>
            [
              "OrderId,Side,Asset,Maker,Price,Quantity",
              ...rows.map((o) => `${o.orderId},${o.side === OrderSide.Buy ? "Buy" : "Sell"},${o.asset},${o.maker},${o.price},${o.quantity}`),
            ].join("\n")
          }
        />
      }
    >
      {notDeployed ? (
        <EmptyState title="OrderBook not deployed" description="The order-book contract is not configured on this network." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(o) => o.orderId.toString()}
              isLoading={isLoading}
              error={isError ? String(error) : null}
              onRetry={refetch}
              emptyTitle="No open orders"
              emptyDescription="Posted limit orders will appear here in real time."
              sort={sort}
              onSortChange={(s) => params.toggleSort(s.id)}
              stickyHeader
            />
            <Pagination page={params.page} limit={params.limit} total={total} onPageChange={params.setPage} />
          </div>
          <div>
            <RequireWallet>
              <PlaceOrderForm onDone={refetch} />
            </RequireWallet>
          </div>
        </div>
      )}
    </ResourceListView>
  );
}

export default function OrderBookPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading order book…" />}>
      <OrderBookInner />
    </Suspense>
  );
}
