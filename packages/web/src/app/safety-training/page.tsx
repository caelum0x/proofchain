"use client";

import { Suspense, useMemo } from "react";
import { useSafetyTrainings, type SafetyTraining } from "@/hooks/useWorkforce";
import { useListParams } from "@/hooks/t5-useListParams";
import { ResourceListView } from "@/components/t5/ResourceListView";
import { SearchInput, SelectFilter, ExportButton } from "@/components/t5/Filters";
import { fmtDate, statusTone, titleCase, fmtNumber } from "@/components/t5/format";
import { apiQuery, toCsv } from "@/components/t5/table-utils";
import { DataTable, type Column, type SortState } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { LoadingState } from "@/components/ui/States";

const STATUS_OPTIONS = [
  { value: "valid", label: "Valid" },
  { value: "expired", label: "Expired" },
  { value: "pending", label: "Pending" },
];

function SafetyTrainingInner() {
  const params = useListParams({ facets: ["status"], defaultSort: "completed_at" });
  const status = params.facet("status");

  const query = useSafetyTrainings(
    apiQuery({ q: params.q, sortId: params.sortId, sortDir: params.sortDir, page: params.page, limit: params.limit, extra: { status: status || undefined } }),
  );

  const columns = useMemo<readonly Column<SafetyTraining>[]>(
    () => [
      { id: "worker", header: "Worker", cell: (r) => (r.worker ? <AddressBadge address={r.worker} /> : "—") },
      { id: "course", header: "Course", cell: (r) => <span className="font-medium text-fg">{r.course ?? "—"}</span> },
      { id: "provider", header: "Provider", cell: (r) => (r.provider ? <AddressBadge address={r.provider} /> : "—") },
      { id: "score", header: "Score", align: "right", sortable: true, cell: (r) => <span className="font-mono">{fmtNumber(r.score)}</span> },
      {
        id: "status",
        header: "Status",
        cell: (r) => <StatusBadge status={statusTone(r.status)}>{titleCase(r.status)}</StatusBadge>,
      },
      { id: "completed_at", header: "Completed", sortable: true, cell: (r) => <span className="text-muted">{fmtDate(r.completed_at)}</span> },
      { id: "expires_at", header: "Expires", sortable: true, cell: (r) => <span className="text-muted">{fmtDate(r.expires_at)}</span> },
    ],
    [],
  );

  const sort: SortState | null = params.sortId ? { id: params.sortId, dir: params.sortDir } : null;
  const valid = query.items.filter((t) => t.status?.toLowerCase() === "valid").length;
  const courses = new Set(query.items.map((t) => t.course).filter(Boolean)).size;

  return (
    <ResourceListView
      title="Safety training"
      subtitle="Worker safety certifications and course completions across the network."
      breadcrumbs={[{ label: "Workforce" }, { label: "Safety training" }]}
      icon="shield"
      accentClassName="text-workforce"
      kpis={[
        { label: "Total records", value: fmtNumber(query.total) },
        { label: "Valid (page)", value: fmtNumber(valid), hintTone: "success" },
        { label: "Courses (page)", value: fmtNumber(courses) },
        { label: "Providers (page)", value: fmtNumber(new Set(query.items.map((t) => t.provider).filter(Boolean)).size) },
      ]}
      kpisLoading={query.isLoading}
      toolbar={
        <>
          <SearchInput value={params.q} onChange={params.setQ} placeholder="Search worker or course" />
          <SelectFilter label="Status" value={status} onChange={(v) => params.setFacet("status", v || null)} options={STATUS_OPTIONS} />
        </>
      }
      toolbarActions={
        <ExportButton
          filename="safety-training.csv"
          disabled={query.items.length === 0}
          getCsv={() =>
            toCsv(query.items, [
              { key: "worker", header: "Worker" },
              { key: "course", header: "Course" },
              { key: "provider", header: "Provider" },
              { key: "score", header: "Score" },
              { key: "status", header: "Status" },
              { key: "completed_at", header: "Completed" },
              { key: "expires_at", header: "Expires" },
            ])
          }
        />
      }
    >
      <DataTable
        columns={columns}
        rows={query.items}
        getRowKey={(r) => r.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        emptyTitle="No safety-training records"
        emptyDescription="Completed safety courses will appear here once workers are certified."
        sort={sort}
        onSortChange={(s) => params.toggleSort(s.id)}
        stickyHeader
      />
      <Pagination page={params.page} limit={params.limit} total={query.total} onPageChange={params.setPage} />
    </ResourceListView>
  );
}

export default function SafetyTrainingPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading safety training…" />}>
      <SafetyTrainingInner />
    </Suspense>
  );
}
