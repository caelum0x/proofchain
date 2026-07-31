"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSkills, type Skill } from "@/hooks/useWorkforce";
import { useListParams } from "@/hooks/t5-useListParams";
import { ResourceListView } from "@/components/t5/ResourceListView";
import { SearchInput, SelectFilter, ExportButton } from "@/components/t5/Filters";
import { fmtDate, fmtNumber, titleCase } from "@/components/t5/format";
import { apiQuery, toCsv } from "@/components/t5/table-utils";
import { DataTable, type Column, type SortState } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { LoadingState } from "@/components/ui/States";

const LEVEL_OPTIONS = [
  { value: "expert", label: "Expert" },
  { value: "advanced", label: "Advanced" },
  { value: "intermediate", label: "Intermediate" },
  { value: "beginner", label: "Beginner" },
];

function SkillsInner() {
  const params = useListParams({ facets: ["level"], defaultSort: "endorsements" });
  const level = params.facet("level");

  const query = useSkills(
    apiQuery({ q: params.q, sortId: params.sortId, sortDir: params.sortDir, page: params.page, limit: params.limit, extra: { level: level || undefined } }),
  );

  const columns = useMemo<readonly Column<Skill>[]>(
    () => [
      {
        id: "worker",
        header: "Worker",
        cell: (r) =>
          r.worker ? (
            <Link href={`/credentials/${r.worker}`} className="text-brand hover:underline">
              <AddressBadge address={r.worker} explorer={false} copyable={false} />
            </Link>
          ) : (
            "—"
          ),
      },
      { id: "skill", header: "Skill", cell: (r) => <span className="font-medium text-fg">{r.skill ?? "—"}</span> },
      { id: "level", header: "Level", cell: (r) => <Badge tone="brand">{titleCase(r.level)}</Badge> },
      { id: "endorsements", header: "Endorsements", align: "right", sortable: true, cell: (r) => <span className="font-mono">{fmtNumber(r.endorsements)}</span> },
      { id: "verified_by", header: "Verified by", cell: (r) => (r.verified_by ? <AddressBadge address={r.verified_by} /> : "—") },
      { id: "attested_at", header: "Attested", sortable: true, cell: (r) => <span className="text-muted">{fmtDate(r.attested_at)}</span> },
    ],
    [],
  );

  const sort: SortState | null = params.sortId ? { id: params.sortId, dir: params.sortDir } : null;

  return (
    <ResourceListView
      title="Skills"
      subtitle="Verified competencies and peer endorsements attested to the worker registry."
      breadcrumbs={[{ label: "Workforce" }, { label: "Skills" }]}
      icon="reputation"
      accentClassName="text-workforce"
      kpis={[
        { label: "Attestations", value: fmtNumber(query.total) },
        { label: "Workers (page)", value: fmtNumber(new Set(query.items.map((s) => s.worker).filter(Boolean)).size) },
        { label: "Distinct skills (page)", value: fmtNumber(new Set(query.items.map((s) => s.skill).filter(Boolean)).size) },
      ]}
      kpisLoading={query.isLoading}
      toolbar={
        <>
          <SearchInput value={params.q} onChange={params.setQ} placeholder="Search skill or worker" />
          <SelectFilter label="Level" value={level} onChange={(v) => params.setFacet("level", v || null)} options={LEVEL_OPTIONS} />
        </>
      }
      toolbarActions={
        <ExportButton
          filename="skills.csv"
          disabled={query.items.length === 0}
          getCsv={() =>
            toCsv(query.items, [
              { key: "worker", header: "Worker" },
              { key: "skill", header: "Skill" },
              { key: "level", header: "Level" },
              { key: "endorsements", header: "Endorsements" },
              { key: "verified_by", header: "Verified by" },
              { key: "attested_at", header: "Attested" },
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
        emptyTitle="No skill attestations"
        emptyDescription="Verified worker skills and endorsements will appear here."
        sort={sort}
        onSortChange={(s) => params.toggleSort(s.id)}
        stickyHeader
      />
      <Pagination page={params.page} limit={params.limit} total={query.total} onPageChange={params.setPage} />
    </ResourceListView>
  );
}

export default function SkillsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading skills…" />}>
      <SkillsInner />
    </Suspense>
  );
}
