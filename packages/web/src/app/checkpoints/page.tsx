"use client";

import { Suspense, useMemo } from "react";
import { useCheckpointFeed, type CheckpointFeedItem } from "@/hooks/provenanceCheckpoints";
import { useListQuery } from "@/hooks/overviewListQuery";
import { getErrorMessage } from "@/lib/errors";
import { explorerTxUrl, formatTimestamp, shortenHex } from "@/lib/format";
import { PageHeader } from "@/components/page/PageHeader";
import { Toolbar } from "@/components/page/Toolbar";
import { KpiRow, type Kpi } from "@/components/ui/KpiRow";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/States";
import { SearchInput } from "@/components/t1/SearchInput";
import { BatchIdCell } from "@/components/t1/BatchIdCell";
import { PAGE_SIZE } from "@/components/t1/provenanceFormat";

function CheckpointsContent() {
  const q = useListQuery();
  const search = q.get("q");
  const page = Math.max(0, q.getNumber("page", 0));
  const { checkpoints, isLoading, isError, error, refetch } = useCheckpointFeed();

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return checkpoints;
    return checkpoints.filter(
      (c) => c.location.toLowerCase().includes(needle) || c.batchId.toLowerCase().includes(needle),
    );
  }, [checkpoints, search]);

  const pageItems = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  const uniqueBatches = useMemo(() => new Set(checkpoints.map((c) => c.batchId.toLowerCase())).size, [checkpoints]);
  const uniqueLocations = useMemo(
    () => new Set(checkpoints.map((c) => c.location.trim().toLowerCase()).filter(Boolean)).size,
    [checkpoints],
  );

  const kpis: readonly Kpi[] = [
    { label: "Checkpoints", value: checkpoints.length, loading: isLoading },
    { label: "Batches tracked", value: uniqueBatches, loading: isLoading },
    { label: "Distinct locations", value: uniqueLocations, loading: isLoading },
  ];

  const columns: readonly Column<CheckpointFeedItem>[] = [
    { id: "batch", header: "Batch", cell: (c) => <BatchIdCell batchId={c.batchId} href="/batches" /> },
    { id: "location", header: "Location", cell: (c) => <span className="text-fg">{c.location || "—"}</span> },
    {
      id: "time",
      header: "Timestamp",
      cell: (c) => <span className="text-muted">{c.timestamp ? formatTimestamp(c.timestamp) : "—"}</span>,
    },
    {
      id: "hash",
      header: "Data hash",
      cell: (c) => <span className="font-mono text-xs text-muted">{shortenHex(c.dataHash, 8, 6)}</span>,
    },
    {
      id: "tx",
      header: "Tx",
      align: "right",
      cell: (c) => (
        <a
          href={explorerTxUrl(c.transactionHash)}
          target="_blank"
          rel="noreferrer noopener"
          className="font-mono text-xs text-brand hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {shortenHex(c.transactionHash, 6, 4)}
        </a>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="checkpoint"
        accentClassName="text-dpp"
        breadcrumbs={[{ label: "Provenance" }, { label: "Checkpoints" }]}
        title="Checkpoints"
        subtitle="Every custody checkpoint recorded across the network, newest first."
      />

      <KpiRow items={kpis} />

      <Toolbar>
        <SearchInput
          value={search}
          onChange={(v) => q.set({ q: v, page: undefined })}
          ariaLabel="Search checkpoints"
          placeholder="Search by location or batch id…"
        />
        <span className="text-xs text-muted">{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
      </Toolbar>

      <DataTable
        columns={columns}
        rows={pageItems}
        getRowKey={(c) => `${c.transactionHash}-${c.logIndex}`}
        isLoading={isLoading}
        error={isError ? getErrorMessage(error) : null}
        onRetry={() => void refetch()}
        emptyTitle="No checkpoints yet"
        emptyDescription="Checkpoints appear here as custody events are recorded on-chain."
      />

      {!isLoading && !isError && filtered.length > PAGE_SIZE ? (
        <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onPageChange={(p) => q.set({ page: p === 0 ? undefined : p })} />
      ) : null}
    </div>
  );
}

export default function CheckpointsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CheckpointsContent />
    </Suspense>
  );
}
