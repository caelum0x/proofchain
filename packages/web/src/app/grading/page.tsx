"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useGradings, type Grading } from "@/hooks/useGrading";
import { useListParams } from "@/hooks/t5-useListParams";
import { ResourceListView } from "@/components/t5/ResourceListView";
import { SearchInput, SelectFilter, ExportButton } from "@/components/t5/Filters";
import { fmtDate, fmtNumber, statusTone, titleCase } from "@/components/t5/format";
import { apiQuery, toCsv } from "@/components/t5/table-utils";
import { DataTable, type Column, type SortState } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { LoadingState } from "@/components/ui/States";
import { shortenHex } from "@/lib/format";

const GRADE_OPTIONS = [
  { value: "A", label: "Grade A" },
  { value: "B", label: "Grade B" },
  { value: "C", label: "Grade C" },
];

function GradingInner() {
  const params = useListParams({ facets: ["grade"], defaultSort: "graded_at" });
  const grade = params.facet("grade");

  const query = useGradings(
    apiQuery({ q: params.q, sortId: params.sortId, sortDir: params.sortDir, page: params.page, limit: params.limit, extra: { grade: grade || undefined } }),
  );

  const columns = useMemo<readonly Column<Grading>[]>(
    () => [
      { id: "commodity", header: "Commodity", cell: (g) => <span className="font-mono font-medium text-fg">{g.commodity ?? "—"}</span> },
      {
        id: "batch",
        header: "Batch",
        cell: (g) =>
          g.batch_id ? (
            <Link href={`/batches/${g.batch_id}`} className="font-mono text-xs text-brand hover:underline">
              {shortenHex(g.batch_id, 5, 4)}
            </Link>
          ) : (
            "—"
          ),
      },
      { id: "grader", header: "Grader", cell: (g) => (g.grader ? <AddressBadge address={g.grader} /> : "—") },
      { id: "grade", header: "Grade", cell: (g) => (g.grade ? <Badge tone="brand">{g.grade}</Badge> : "—") },
      { id: "score", header: "Score", align: "right", sortable: true, cell: (g) => <span className="font-mono">{fmtNumber(g.score)}</span> },
      { id: "method", header: "Method", cell: (g) => <span className="text-muted">{titleCase(g.method)}</span> },
      { id: "status", header: "Status", cell: (g) => <StatusBadge status={statusTone(g.status)}>{titleCase(g.status)}</StatusBadge> },
      { id: "graded_at", header: "Graded", sortable: true, cell: (g) => <span className="text-muted">{fmtDate(g.graded_at)}</span> },
    ],
    [],
  );

  const sort: SortState | null = params.sortId ? { id: params.sortId, dir: params.sortDir } : null;

  return (
    <ResourceListView
      title="Grading"
      subtitle="Independent quality assessments of commodity lots and provenance batches."
      breadcrumbs={[{ label: "Markets" }, { label: "Grading" }]}
      icon="verifier"
      accentClassName="text-markets"
      kpis={[
        { label: "Assessments", value: fmtNumber(query.total) },
        { label: "Graders (page)", value: fmtNumber(new Set(query.items.map((g) => g.grader).filter(Boolean)).size) },
        { label: "Grade A (page)", value: fmtNumber(query.items.filter((g) => (g.grade ?? "").toUpperCase().startsWith("A")).length), hintTone: "success" },
        { label: "Commodities (page)", value: fmtNumber(new Set(query.items.map((g) => g.commodity).filter(Boolean)).size) },
      ]}
      kpisLoading={query.isLoading}
      toolbar={
        <>
          <SearchInput value={params.q} onChange={params.setQ} placeholder="Search commodity or grader" />
          <SelectFilter label="Grade" value={grade} onChange={(v) => params.setFacet("grade", v || null)} options={GRADE_OPTIONS} />
        </>
      }
      toolbarActions={
        <ExportButton
          filename="grading.csv"
          disabled={query.items.length === 0}
          getCsv={() =>
            toCsv(query.items, [
              { key: "commodity", header: "Commodity" },
              { key: "batch_id", header: "Batch" },
              { key: "grader", header: "Grader" },
              { key: "grade", header: "Grade" },
              { key: "score", header: "Score" },
              { key: "method", header: "Method" },
              { key: "status", header: "Status" },
              { key: "graded_at", header: "Graded" },
            ])
          }
        />
      }
    >
      <DataTable
        columns={columns}
        rows={query.items}
        getRowKey={(g) => g.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        emptyTitle="No grading records"
        emptyDescription="Quality assessments will appear here once graders submit verdicts."
        sort={sort}
        onSortChange={(s) => params.toggleSort(s.id)}
        stickyHeader
      />
      <Pagination page={params.page} limit={params.limit} total={query.total} onPageChange={params.setPage} />
    </ResourceListView>
  );
}

export default function GradingPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading grading…" />}>
      <GradingInner />
    </Suspense>
  );
}
