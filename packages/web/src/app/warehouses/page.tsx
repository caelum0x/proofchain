"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Toolbar, FilterBar, SearchParamsBoundary } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Pagination } from "@/components/ui/Pagination";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Callout } from "@/components/ui/Callout";
import { RequireWallet } from "@/components/RequireWallet";
import { IssueReceiptForm } from "@/components/t4/IssueReceiptForm";
import { useWarehouseReceipts, type WarehouseReceiptItem } from "@/hooks/logisticsWarehouses";
import { useT4ListState } from "@/hooks/t4UrlListState";
import { getErrorMessage } from "@/lib/errors";
import { shortenHex } from "@/lib/format";

const PAGE_SIZE = 12;

function WarehousesPageContent() {
  const router = useRouter();
  const { receipts, isRedeemed, isLoading, isError, error, notDeployed, refetch } = useWarehouseReceipts();
  const url = useT4ListState();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const status = url.get("status");

  const rows = useMemo(() => {
    const q = url.q.trim().toLowerCase();
    return receipts.filter((r) => {
      const redeemed = isRedeemed(r.tokenId);
      if (status === "active" && redeemed) return false;
      if (status === "redeemed" && !redeemed) return false;
      if (q && !r.location.toLowerCase().includes(q) && !r.batchId.toLowerCase().includes(q) && !r.to.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [receipts, url.q, status, isRedeemed]);

  const totals = useMemo(() => {
    const redeemed = receipts.filter((r) => isRedeemed(r.tokenId)).length;
    const quantity = receipts.reduce((sum, r) => sum + r.quantity, 0n);
    return { redeemed, active: receipts.length - redeemed, quantity };
  }, [receipts, isRedeemed]);

  const page = Math.min(url.page, Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1));
  const paged = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const columns: readonly Column<WarehouseReceiptItem>[] = [
    { id: "tokenId", header: "Receipt", cell: (r) => <span className="font-mono text-xs">#{r.tokenId.toString()}</span> },
    { id: "batchId", header: "Batch", cell: (r) => <span className="font-mono text-xs">{shortenHex(r.batchId, 5, 5)}</span> },
    { id: "location", header: "Location", cell: (r) => r.location || "—" },
    { id: "quantity", header: "Qty", align: "right", cell: (r) => r.quantity.toLocaleString() },
    { id: "holder", header: "Holder", cell: (r) => <AddressBadge address={r.to} /> },
    {
      id: "status",
      header: "Status",
      cell: (r) =>
        isRedeemed(r.tokenId) ? (
          <StatusBadge status="neutral">Redeemed</StatusBadge>
        ) : (
          <StatusBadge status="success">Active</StatusBadge>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        subtitle="Tokenized warehouse receipts (ERC-721) issued against stored batches."
        icon="warehouse"
        accentClassName="text-logistics"
        breadcrumbs={[{ label: "Logistics", href: "/logistics" }, { label: "Warehouses" }]}
        actions={<Button onClick={() => setDrawerOpen(true)}>Issue receipt</Button>}
      />

      <KpiRow
        loading={isLoading}
        items={[
          { label: "Receipts", value: receipts.length.toLocaleString() },
          { label: "Active", value: totals.active.toLocaleString(), hintTone: "success" },
          { label: "Redeemed", value: totals.redeemed.toLocaleString() },
          { label: "Total quantity", value: totals.quantity.toLocaleString(), hint: "units stored" },
        ]}
      />

      <Toolbar
        actions={
          <FilterBar>
            <Select
              aria-label="Filter by status"
              className="w-40"
              value={status ?? "all"}
              onChange={(e) => url.setParams({ status: e.target.value === "all" ? null : e.target.value })}
              options={[
                { value: "all", label: "All receipts" },
                { value: "active", label: "Active" },
                { value: "redeemed", label: "Redeemed" },
              ]}
            />
          </FilterBar>
        }
      >
        <Input
          aria-label="Search receipts"
          placeholder="Search by location, batch, or holder…"
          className="max-w-xs"
          value={url.q}
          onChange={(e) => url.setParams({ q: e.target.value })}
        />
      </Toolbar>

      {notDeployed ? (
        <Callout tone="info" title="WarehouseReceipt not deployed">
          Warehouse receipts are unavailable on this network.
        </Callout>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={paged}
            getRowKey={(r) => r.tokenId.toString()}
            onRowClick={(r) => router.push(`/warehouses/${r.tokenId.toString()}`)}
            isLoading={isLoading}
            error={isError ? getErrorMessage(error) : null}
            onRetry={refetch}
            emptyTitle="No receipts yet"
            emptyDescription="Issued warehouse receipts appear here."
          />
          {rows.length > PAGE_SIZE ? (
            <Pagination page={page} limit={PAGE_SIZE} total={rows.length} onPageChange={url.setPage} />
          ) : null}
        </>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Issue a warehouse receipt">
        <RequireWallet>
          <IssueReceiptForm onDone={() => { setDrawerOpen(false); refetch(); }} />
        </RequireWallet>
      </Drawer>
    </div>
  );
}

export default function WarehousesPage() {
  return (
    <SearchParamsBoundary>
      <WarehousesPageContent />
    </SearchParamsBoundary>
  );
}
