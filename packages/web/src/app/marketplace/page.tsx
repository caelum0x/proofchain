"use client";

import Link from "next/link";
import { useListings, useOrders, OrderSide } from "@/hooks/useMarketplace";
import { ListingRow } from "@/components/marketplace/ListingRow";
import { CreateListingForm } from "@/components/marketplace/CreateListingForm";
import { PlaceOrderForm } from "@/components/marketplace/PlaceOrderForm";
import { RequireWallet } from "@/components/RequireWallet";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AddressLink } from "@/components/ui/TxLink";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { getErrorMessage } from "@/lib/errors";
import type { OrderEvent } from "@/hooks/useMarketplace";

export default function MarketplacePage() {
  const listings = useListings();
  const orders = useOrders();

  const orderCols: readonly Column<OrderEvent>[] = [
    { id: "id", header: "#", cell: (o) => <span className="font-mono text-xs">{o.orderId.toString()}</span> },
    {
      id: "side",
      header: "Side",
      cell: (o) => (
        <Badge tone={o.side === OrderSide.Buy ? "success" : "danger"}>{o.side === OrderSide.Buy ? "Buy" : "Sell"}</Badge>
      ),
    },
    { id: "asset", header: "Asset", cell: (o) => <AddressBadge address={o.asset} /> },
    { id: "maker", header: "Maker", cell: (o) => <AddressLink address={o.maker} /> },
    { id: "price", header: "Price", align: "right", cell: (o) => <span className="font-mono text-xs">{o.price.toString()}</span> },
    { id: "qty", header: "Qty", align: "right", cell: (o) => o.quantity.toString() },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Marketplace</h1>
          <p className="mt-1 text-sm text-muted">
            Order book and listings for tokenized assets — receivables, NFTs, and carbon credits.
          </p>
        </div>
        <Link href="/marketplace/auctions" className="text-sm text-brand hover:underline">
          English auctions →
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-0">
            <div className="p-4">
              <CardHeader title="Listings" description="Fixed-price offers recorded on the ListingRegistry." />
            </div>
            {listings.notDeployed ? (
              <div className="p-4">
                <EmptyState title="ListingRegistry not deployed" description="Not configured on this network." />
              </div>
            ) : listings.isError ? (
              <div className="p-4">
                <ErrorState message={getErrorMessage(listings.error)} onRetry={listings.refetch} />
              </div>
            ) : listings.listings.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No listings yet" description="Created listings appear here in real time." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Kind</th>
                      <th className="px-4 py-3 font-medium">Asset</th>
                      <th className="px-4 py-3 font-medium">Seller</th>
                      <th className="px-4 py-3 text-right font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {listings.listings.map((listing) => (
                      <ListingRow key={listing.listingId.toString()} listing={listing} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Order book" description="Open limit orders for fungible tokenized units." />
            {orders.notDeployed ? (
              <EmptyState title="OrderBook not deployed" description="Not configured on this network." />
            ) : orders.isError ? (
              <ErrorState message={getErrorMessage(orders.error)} onRetry={orders.refetch} />
            ) : (
              <DataTable
                columns={orderCols}
                rows={orders.orders}
                getRowKey={(o) => o.orderId.toString()}
                isLoading={orders.isLoading}
                emptyTitle="No orders yet"
              />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <RequireWallet>
            <CreateListingForm onDone={listings.refetch} />
            <PlaceOrderForm onDone={orders.refetch} />
          </RequireWallet>
        </div>
      </div>
    </div>
  );
}
