"use client";

import { Suspense, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRecalls, type RecallItem } from "@/hooks/provenanceRecalls";
import { useListQuery } from "@/hooks/overviewListQuery";
import { getErrorMessage } from "@/lib/errors";
import { formatBps } from "@/lib/format";
import { PageHeader } from "@/components/page/PageHeader";
import { Toolbar, FilterBar } from "@/components/page/Toolbar";
import { KpiRow, type Kpi } from "@/components/ui/KpiRow";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Select } from "@/components/ui/Select";
import { Callout } from "@/components/ui/Callout";
import { LoadingState } from "@/components/ui/States";
import { BatchIdCell } from "@/components/t1/BatchIdCell";
import { recallStatus } from "@/components/t1/provenanceFormat";

type ReasonFilter = "all" | "failed-verification" | "disputed";

const REASON_OPTIONS = [
  { value: "all", label: "All reasons" },
  { value: "failed-verification", label: "Failed verification" },
  { value: "disputed", label: "Disputed" },
];

function RecallsContent() {
  const router = useRouter();
  const q = useListQuery();
  const reason = (q.get("reason", "all") as ReasonFilter) || "all";

  const { recalls, total, isLoading, isError, error, refetch } = useRecalls();

  const filtered = useMemo(
    () => (reason === "all" ? recalls : recalls.filter((r) => r.reason === reason)),
    [recalls, reason],
  );

  const failedCount = recalls.filter((r) => r.reason === "failed-verification").length;
  const disputedCount = recalls.filter((r) => r.reason === "disputed").length;

  const kpis: readonly Kpi[] = [
    { label: "Active recalls", value: recalls.length, hintTone: recalls.length ? "danger" : "success", loading: isLoading },
    { label: "Failed verification", value: failedCount, loading: isLoading },
    { label: "Disputed", value: disputedCount, loading: isLoading },
    { label: "Recall rate", value: total ? formatBps(Math.round((recalls.length / total) * 10000)) : "—", loading: isLoading },
  ];

  const columns: readonly Column<RecallItem>[] = [
    { id: "batch", header: "Batch", cell: (r) => <BatchIdCell batchId={r.batchId} href="/batches" /> },
    {
      id: "reason",
      header: "Reason",
      cell: (r) => {
        const v = recallStatus(r.reason);
        return <StatusBadge status={v.status}>{v.label}</StatusBadge>;
      },
    },
    {
      id: "score",
      header: "Score",
      cell: (r) => <span className="font-mono text-xs text-muted">{r.score !== undefined ? formatBps(r.score) : "—"}</span>,
    },
    { id: "supplier", header: "Supplier", cell: (r) => <AddressBadge address={r.supplier} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="recall"
        accentClassName="text-danger"
        breadcrumbs={[{ label: "Provenance" }, { label: "Recalls" }]}
        title="Recalls"
        subtitle="Batches flagged for recall — derived live from failed verifications and disputed settlements."
      />

      <KpiRow items={kpis} />

      {!isLoading && !isError && recalls.length === 0 ? (
        <Callout tone="success" title="No active recalls">
          No batch has failed verification or entered a dispute. This register updates in real time as
          on-chain state changes.
        </Callout>
      ) : (
        <>
          <Toolbar>
            <FilterBar>
              <Select
                options={REASON_OPTIONS}
                value={reason}
                aria-label="Filter by reason"
                onChange={(e) => q.set({ reason: e.target.value === "all" ? undefined : e.target.value })}
                className="w-56"
              />
            </FilterBar>
            <span className="text-xs text-muted">{filtered.length} flagged</span>
          </Toolbar>

          <DataTable
            columns={columns}
            rows={filtered}
            getRowKey={(r) => `${r.batchId}-${r.reason}`}
            onRowClick={(r) => router.push(`/batches/${r.batchId}`)}
            isLoading={isLoading}
            error={isError ? getErrorMessage(error) : null}
            onRetry={() => void refetch()}
            emptyTitle="No matching recalls"
            emptyDescription="No batches match this reason filter."
          />
        </>
      )}
    </div>
  );
}

export default function RecallsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RecallsContent />
    </Suspense>
  );
}
