"use client";

import { Suspense, useMemo } from "react";
import { useActivityFeed, type ActivityItem } from "@/hooks/overviewActivity";
import { useListQuery } from "@/hooks/overviewListQuery";
import { getErrorMessage } from "@/lib/errors";
import { explorerTxUrl, shortenHex } from "@/lib/format";
import type { TimelineKind } from "@/lib/types";
import { PageHeader } from "@/components/page/PageHeader";
import { Toolbar, FilterBar } from "@/components/page/Toolbar";
import { KpiRow, type Kpi } from "@/components/ui/KpiRow";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/States";
import { SearchInput } from "@/components/t1/SearchInput";
import { BatchIdCell } from "@/components/t1/BatchIdCell";
import { activityTone, PAGE_SIZE } from "@/components/t1/provenanceFormat";

const KIND_OPTIONS = [
  { value: "all", label: "All events" },
  { value: "registered", label: "Registered" },
  { value: "checkpoint", label: "Checkpoints" },
  { value: "attested", label: "Attested" },
  { value: "funded", label: "Funded" },
  { value: "released", label: "Settled" },
  { value: "disputed", label: "Disputed" },
  { value: "refunded", label: "Refunded" },
];

function ActivityContent() {
  const q = useListQuery();
  const search = q.get("q");
  const kind = q.get("kind", "all");
  const page = Math.max(0, q.getNumber("page", 0));

  const { activity, isLoading, isError, error, refetch } = useActivityFeed();

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return activity.filter((a) => {
      if (kind !== "all" && a.kind !== kind) return false;
      if (needle && !a.batchId.toLowerCase().includes(needle) && !a.title.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [activity, search, kind]);

  const pageItems = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  const count = (k: TimelineKind) => activity.filter((a) => a.kind === k).length;
  const kpis: readonly Kpi[] = [
    { label: "Events", value: activity.length, loading: isLoading },
    { label: "Registrations", value: count("registered"), loading: isLoading },
    { label: "Attestations", value: count("attested"), hintTone: "success", loading: isLoading },
    { label: "Settlements", value: count("released"), hintTone: "brand", loading: isLoading },
  ];

  const columns: readonly Column<ActivityItem>[] = [
    {
      id: "event",
      header: "Event",
      cell: (a) => <StatusBadge status={activityTone(a.kind)}>{a.title}</StatusBadge>,
    },
    {
      id: "batch",
      header: "Batch",
      cell: (a) => (a.batchId && a.batchId !== "0x" ? <BatchIdCell batchId={a.batchId} href="/batches" /> : <span className="text-faint">—</span>),
    },
    { id: "detail", header: "Detail", cell: (a) => <span className="text-muted">{a.detail ?? "—"}</span> },
    {
      id: "block",
      header: "Block",
      align: "right",
      cell: (a) => <span className="font-mono text-xs text-muted">#{a.blockNumber.toString()}</span>,
    },
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
        icon="activity"
        accentClassName="text-brand"
        breadcrumbs={[{ label: "Overview" }, { label: "Activity" }]}
        title="Activity"
        subtitle="A live, network-wide stream of every provenance and settlement event."
      />

      <KpiRow items={kpis} />

      <Toolbar>
        <SearchInput
          value={search}
          onChange={(v) => q.set({ q: v, page: undefined })}
          ariaLabel="Search activity"
          placeholder="Search by batch id or event…"
        />
        <FilterBar>
          <Select
            options={KIND_OPTIONS}
            value={kind}
            aria-label="Filter by event type"
            onChange={(e) => q.set({ kind: e.target.value === "all" ? undefined : e.target.value, page: undefined })}
            className="w-48"
          />
        </FilterBar>
        <span className="text-xs text-muted">{filtered.length} event{filtered.length === 1 ? "" : "s"}</span>
      </Toolbar>

      <DataTable
        columns={columns}
        rows={pageItems}
        getRowKey={(a) => `${a.transactionHash}-${a.logIndex}`}
        isLoading={isLoading}
        error={isError ? getErrorMessage(error) : null}
        onRetry={() => void refetch()}
        emptyTitle="No activity yet"
        emptyDescription="Network events will stream in here as they happen on-chain."
      />

      {!isLoading && !isError && filtered.length > PAGE_SIZE ? (
        <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onPageChange={(p) => q.set({ page: p === 0 ? undefined : p })} />
      ) : null}
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ActivityContent />
    </Suspense>
  );
}
