"use client";

import { Suspense, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStorageReceipts, type StorageReceipt } from "@/hooks/useStorageReceipts";
import { useListParams } from "@/hooks/t5-useListParams";
import { ResourceListView } from "@/components/t5/ResourceListView";
import { SearchInput, SelectFilter, ExportButton } from "@/components/t5/Filters";
import { applyTableState, compareBigint, type Comparator } from "@/components/t5/table-utils";
import { fmtNumber } from "@/components/t5/format";
import { DataTable, type Column, type SortState } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { shortenHex } from "@/lib/format";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "redeemed", label: "Redeemed" },
];

const comparators: Readonly<Record<string, Comparator<StorageReceipt>>> = {
  tokenId: (a, b) => compareBigint(a.tokenId, b.tokenId),
  quantity: (a, b) => compareBigint(a.quantity, b.quantity),
};

function StorageReceiptsInner() {
  const router = useRouter();
  const params = useListParams({ facets: ["status"], defaultSort: "tokenId" });
  const status = params.facet("status");
  const { receipts, isLoading, error, notDeployed, refetch } = useStorageReceipts();

  const filtered = useMemo(() => {
    if (!status) return receipts;
    const wantRedeemed = status === "redeemed";
    return receipts.filter((r) => r.redeemed === wantRedeemed);
  }, [receipts, status]);

  const { rows, total } = useMemo(
    () =>
      applyTableState({
        rows: filtered,
        q: params.q,
        search: (r) => `${r.tokenId} ${r.owner} ${r.location} ${r.batchId}`,
        sortId: params.sortId,
        sortDir: params.sortDir,
        comparators,
        page: params.page,
        limit: params.limit,
      }),
    [filtered, params.q, params.sortId, params.sortDir, params.page, params.limit],
  );

  const columns = useMemo<readonly Column<StorageReceipt>[]>(
    () => [
      { id: "tokenId", header: "Receipt", sortable: true, cell: (r) => <span className="font-mono text-fg">#{r.tokenId.toString()}</span> },
      { id: "owner", header: "Holder", cell: (r) => <AddressBadge address={r.owner} /> },
      {
        id: "batch",
        header: "Batch",
        cell: (r) => (
          <Link href={`/batches/${r.batchId}`} className="font-mono text-xs text-brand hover:underline">
            {shortenHex(r.batchId, 5, 4)}
          </Link>
        ),
      },
      { id: "quantity", header: "Quantity", align: "right", sortable: true, cell: (r) => <span className="font-mono">{r.quantity.toString()}</span> },
      { id: "location", header: "Location", cell: (r) => r.location || "—" },
      {
        id: "status",
        header: "Status",
        cell: (r) => <StatusBadge status={r.redeemed ? "neutral" : "success"}>{r.redeemed ? "Redeemed" : "Active"}</StatusBadge>,
      },
    ],
    [],
  );

  const sort: SortState | null = params.sortId ? { id: params.sortId, dir: params.sortDir } : null;
  const active = receipts.filter((r) => !r.redeemed).length;
  const totalQty = receipts.reduce((sum, r) => sum + r.quantity, 0n);

  return (
    <ResourceListView
      title="Storage receipts"
      subtitle="Warehouse receipts — tokenized claims on stored goods, redeemable on-chain."
      breadcrumbs={[{ label: "Markets" }, { label: "Storage receipts" }]}
      icon="warehouse"
      accentClassName="text-markets"
      kpis={[
        { label: "Receipts", value: fmtNumber(receipts.length) },
        { label: "Active", value: fmtNumber(active), hintTone: "success" },
        { label: "Redeemed", value: fmtNumber(receipts.length - active) },
        { label: "Total quantity", value: totalQty.toString() },
      ]}
      kpisLoading={isLoading}
      toolbar={
        <>
          <SearchInput value={params.q} onChange={params.setQ} placeholder="Search location, holder, batch" />
          <SelectFilter label="Status" value={status} onChange={(v) => params.setFacet("status", v || null)} options={STATUS_OPTIONS} />
        </>
      }
      toolbarActions={
        <ExportButton
          filename="storage-receipts.csv"
          disabled={rows.length === 0}
          getCsv={() =>
            [
              "Receipt,Holder,Batch,Quantity,Location,Status",
              ...rows.map((r) => `#${r.tokenId},${r.owner},${r.batchId},${r.quantity},"${r.location}",${r.redeemed ? "Redeemed" : "Active"}`),
            ].join("\n")
          }
        />
      }
    >
      {notDeployed ? (
        <EmptyState title="WarehouseReceipt not deployed" description="The warehouse-receipt contract is not configured on this network." />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(r) => r.tokenId.toString()}
            onRowClick={(r) => router.push(`/nft/${r.tokenId.toString()}?collection=WarehouseReceipt`)}
            isLoading={isLoading}
            error={error ? String(error) : null}
            onRetry={refetch}
            emptyTitle="No storage receipts"
            emptyDescription="Issued warehouse receipts will appear here in real time."
            sort={sort}
            onSortChange={(s) => params.toggleSort(s.id)}
            stickyHeader
          />
          <Pagination page={params.page} limit={params.limit} total={total} onPageChange={params.setPage} />
        </>
      )}
    </ResourceListView>
  );
}

export default function StorageReceiptsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading storage receipts…" />}>
      <StorageReceiptsInner />
    </Suspense>
  );
}
