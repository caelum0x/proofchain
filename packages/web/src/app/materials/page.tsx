"use client";

import { Suspense, useMemo } from "react";
import { useCheckpointFeed } from "@/hooks/provenanceCheckpoints";
import { useBatches } from "@/hooks/useBatches";
import { useListQuery } from "@/hooks/overviewListQuery";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestamp } from "@/lib/format";
import { PageHeader } from "@/components/page/PageHeader";
import { Toolbar } from "@/components/page/Toolbar";
import { KpiRow, type Kpi } from "@/components/ui/KpiRow";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { LoadingState } from "@/components/ui/States";
import { SearchInput } from "@/components/t1/SearchInput";
import { PAGE_SIZE } from "@/components/t1/provenanceFormat";
import { Pagination } from "@/components/ui/Pagination";

/** A material handling node aggregated from checkpoints sharing a location. */
interface MaterialNode {
  readonly location: string;
  readonly batches: number;
  readonly checkpoints: number;
  readonly lastActivity: number;
}

function MaterialsContent() {
  const q = useListQuery();
  const search = q.get("q");
  const page = Math.max(0, q.getNumber("page", 0));

  const { checkpoints, isLoading, isError, error, refetch } = useCheckpointFeed();
  const { batches } = useBatches();

  const nodes = useMemo<MaterialNode[]>(() => {
    const map = new Map<string, { batches: Set<string>; checkpoints: number; last: number }>();
    for (const cp of checkpoints) {
      const key = cp.location.trim() || "(unlabelled)";
      const entry = map.get(key) ?? { batches: new Set<string>(), checkpoints: 0, last: 0 };
      entry.batches.add(cp.batchId.toLowerCase());
      entry.checkpoints += 1;
      entry.last = Math.max(entry.last, cp.timestamp);
      map.set(key, entry);
    }
    return [...map.entries()]
      .map(([location, e]) => ({ location, batches: e.batches.size, checkpoints: e.checkpoints, lastActivity: e.last }))
      .sort((a, b) => b.checkpoints - a.checkpoints);
  }, [checkpoints]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return nodes;
    return nodes.filter((n) => n.location.toLowerCase().includes(needle));
  }, [nodes, search]);

  const pageItems = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  const kpis: readonly Kpi[] = [
    { label: "Handling nodes", value: nodes.length, loading: isLoading },
    { label: "Material lots", value: batches.length, loading: isLoading },
    { label: "Checkpoints", value: checkpoints.length, loading: isLoading },
    { label: "Avg / lot", value: batches.length ? (checkpoints.length / batches.length).toFixed(1) : "—", loading: isLoading },
  ];

  const columns: readonly Column<MaterialNode>[] = [
    { id: "location", header: "Handling node", cell: (n) => <span className="font-medium text-fg">{n.location}</span> },
    { id: "batches", header: "Lots", align: "right", cell: (n) => <span className="font-mono text-fg">{n.batches}</span> },
    { id: "checkpoints", header: "Checkpoints", align: "right", cell: (n) => <span className="font-mono text-muted">{n.checkpoints}</span> },
    {
      id: "last",
      header: "Last activity",
      align: "right",
      cell: (n) => <span className="text-muted">{n.lastActivity ? formatTimestamp(n.lastActivity) : "—"}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="materials"
        accentClassName="text-dpp"
        breadcrumbs={[{ label: "Provenance" }, { label: "Materials" }]}
        title="Materials"
        subtitle="Material handling nodes aggregated from custody checkpoints across every lot."
      />

      <KpiRow items={kpis} />

      <Toolbar>
        <SearchInput
          value={search}
          onChange={(v) => q.set({ q: v, page: undefined })}
          ariaLabel="Search handling nodes"
          placeholder="Search by handling node…"
        />
        <span className="text-xs text-muted">{filtered.length} node{filtered.length === 1 ? "" : "s"}</span>
      </Toolbar>

      <DataTable
        columns={columns}
        rows={pageItems}
        getRowKey={(n) => n.location}
        isLoading={isLoading}
        error={isError ? getErrorMessage(error) : null}
        onRetry={() => void refetch()}
        emptyTitle="No material flow yet"
        emptyDescription="Handling nodes appear here once checkpoints are recorded for material lots."
      />

      {!isLoading && !isError && filtered.length > PAGE_SIZE ? (
        <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onPageChange={(p) => q.set({ page: p === 0 ? undefined : p })} />
      ) : null}
    </div>
  );
}

export default function MaterialsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <MaterialsContent />
    </Suspense>
  );
}
