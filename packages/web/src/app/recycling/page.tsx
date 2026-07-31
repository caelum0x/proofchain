"use client";

import { Suspense, useMemo } from "react";
import { useActivityFeed, type ActivityItem } from "@/hooks/overviewActivity";
import { useListQuery } from "@/hooks/overviewListQuery";
import { getErrorMessage } from "@/lib/errors";
import { explorerTxUrl, formatBps, shortenHex } from "@/lib/format";
import { PageHeader } from "@/components/page/PageHeader";
import { Toolbar } from "@/components/page/Toolbar";
import { KpiRow, type Kpi } from "@/components/ui/KpiRow";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Pagination } from "@/components/ui/Pagination";
import { Callout } from "@/components/ui/Callout";
import { LoadingState } from "@/components/ui/States";
import { SearchInput } from "@/components/t1/SearchInput";
import { BatchIdCell } from "@/components/t1/BatchIdCell";
import { activityTone, PAGE_SIZE } from "@/components/t1/provenanceFormat";

/**
 * Provenance → Recycling. A circularity ledger: settlement refunds return goods
 * to the buyer (recovery), releases consume the lot. Recovery rate and events are
 * derived live from real settlement state — no separate registry required.
 */
function RecyclingContent() {
  const q = useListQuery();
  const search = q.get("q");
  const page = Math.max(0, q.getNumber("page", 0));

  const { activity, isLoading, isError, error, refetch } = useActivityFeed();

  const recovered = activity.filter((a) => a.kind === "refunded").length;
  const consumed = activity.filter((a) => a.kind === "released").length;
  const inReview = activity.filter((a) => a.kind === "disputed").length;
  const total = recovered + consumed;

  const events = useMemo(
    () => activity.filter((a) => a.kind === "refunded" || a.kind === "disputed"),
    [activity],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return events;
    return events.filter((a) => a.batchId.toLowerCase().includes(needle));
  }, [events, search]);

  const pageItems = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  const kpis: readonly Kpi[] = [
    { label: "Recovered lots", value: recovered, hintTone: "success", loading: isLoading },
    { label: "Consumed lots", value: consumed, loading: isLoading },
    { label: "Recovery rate", value: total ? formatBps(Math.round((recovered / total) * 10000)) : "—", hintTone: "brand", loading: isLoading },
    { label: "In review", value: inReview, hintTone: "warn", loading: isLoading },
  ];

  const columns: readonly Column<ActivityItem>[] = [
    {
      id: "event",
      header: "Event",
      cell: (a) => <StatusBadge status={activityTone(a.kind)}>{a.kind === "refunded" ? "Recovered" : "In review"}</StatusBadge>,
    },
    { id: "batch", header: "Lot", cell: (a) => <BatchIdCell batchId={a.batchId} href="/batches" /> },
    { id: "detail", header: "Detail", cell: (a) => <span className="text-muted">{a.detail ?? "—"}</span> },
    {
      id: "tx",
      header: "Tx",
      align: "right",
      cell: (a) => (
        <a
          href={explorerTxUrl(a.transactionHash)}
          target="_blank"
          rel="noreferrer noopener"
          className="font-mono text-xs text-brand hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {shortenHex(a.transactionHash, 6, 4)}
        </a>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="recycle"
        accentClassName="text-sustainability"
        breadcrumbs={[{ label: "Provenance" }, { label: "Recycling" }]}
        title="Recycling & circularity"
        subtitle="Material recovery and end-of-life events, derived live from settlement outcomes."
      />

      <KpiRow items={kpis} />

      <Callout tone="info" title="How recovery is measured">
        A refunded escrow returns the lot to the buyer (recovered); a released escrow consumes it.
        Recovery rate is recovered ÷ (recovered + consumed).
      </Callout>

      <Toolbar>
        <SearchInput
          value={search}
          onChange={(v) => q.set({ q: v, page: undefined })}
          ariaLabel="Search recovery events"
          placeholder="Search by lot id…"
        />
        <span className="text-xs text-muted">{filtered.length} event{filtered.length === 1 ? "" : "s"}</span>
      </Toolbar>

      <DataTable
        columns={columns}
        rows={pageItems}
        getRowKey={(a) => `${a.transactionHash}-${a.logIndex}`}
        isLoading={isLoading}
        error={isError ? getErrorMessage(error) : null}
        onRetry={() => void refetch()}
        emptyTitle="No recovery events yet"
        emptyDescription="Recovered and returned lots appear here as settlements resolve."
      />

      {!isLoading && !isError && filtered.length > PAGE_SIZE ? (
        <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onPageChange={(p) => q.set({ page: p === 0 ? undefined : p })} />
      ) : null}
    </div>
  );
}

export default function RecyclingPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RecyclingContent />
    </Suspense>
  );
}
