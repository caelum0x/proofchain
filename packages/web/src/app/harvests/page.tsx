"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useHarvests, type Harvest } from "@/hooks/useHarvests";
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

const STATUS_OPTIONS = [
  { value: "harvested", label: "Harvested" },
  { value: "graded", label: "Graded" },
  { value: "stored", label: "Stored" },
  { value: "shipped", label: "Shipped" },
];

function HarvestsInner() {
  const params = useListParams({ facets: ["status"], defaultSort: "harvested_at" });
  const status = params.facet("status");

  const query = useHarvests(
    apiQuery({ q: params.q, sortId: params.sortId, sortDir: params.sortDir, page: params.page, limit: params.limit, extra: { status: status || undefined } }),
  );

  const columns = useMemo<readonly Column<Harvest>[]>(
    () => [
      { id: "commodity", header: "Commodity", cell: (h) => <span className="font-mono font-medium text-fg">{h.commodity ?? "—"}</span> },
      { id: "producer", header: "Producer", cell: (h) => (h.producer ? <AddressBadge address={h.producer} /> : "—") },
      { id: "region", header: "Region", cell: (h) => h.region ?? "—" },
      { id: "quantity", header: "Quantity", align: "right", sortable: true, cell: (h) => <span className="font-mono">{fmtNumber(h.quantity)} {h.unit ?? ""}</span> },
      { id: "grade", header: "Grade", cell: (h) => (h.grade ? <Badge tone="brand">{h.grade}</Badge> : "—") },
      {
        id: "batch",
        header: "Batch",
        cell: (h) =>
          h.batch_id ? (
            <Link href={`/batches/${h.batch_id}`} className="font-mono text-xs text-brand hover:underline">
              {shortenHex(h.batch_id, 5, 4)}
            </Link>
          ) : (
            "—"
          ),
      },
      { id: "status", header: "Status", cell: (h) => <StatusBadge status={statusTone(h.status)}>{titleCase(h.status)}</StatusBadge> },
      { id: "harvested_at", header: "Harvested", sortable: true, cell: (h) => <span className="text-muted">{fmtDate(h.harvested_at)}</span> },
    ],
    [],
  );

  const sort: SortState | null = params.sortId ? { id: params.sortId, dir: params.sortDir } : null;

  return (
    <ResourceListView
      title="Harvests"
      subtitle="Harvested commodity lots with producer, region, and quality grade — linkable to provenance batches."
      breadcrumbs={[{ label: "Markets" }, { label: "Harvests" }]}
      icon="harvest"
      accentClassName="text-markets"
      kpis={[
        { label: "Total lots", value: fmtNumber(query.total) },
        { label: "Producers (page)", value: fmtNumber(new Set(query.items.map((h) => h.producer).filter(Boolean)).size) },
        { label: "Regions (page)", value: fmtNumber(new Set(query.items.map((h) => h.region).filter(Boolean)).size) },
        { label: "Commodities (page)", value: fmtNumber(new Set(query.items.map((h) => h.commodity).filter(Boolean)).size) },
      ]}
      kpisLoading={query.isLoading}
      toolbar={
        <>
          <SearchInput value={params.q} onChange={params.setQ} placeholder="Search commodity or region" />
          <SelectFilter label="Status" value={status} onChange={(v) => params.setFacet("status", v || null)} options={STATUS_OPTIONS} />
        </>
      }
      toolbarActions={
        <ExportButton
          filename="harvests.csv"
          disabled={query.items.length === 0}
          getCsv={() =>
            toCsv(query.items, [
              { key: "commodity", header: "Commodity" },
              { key: "producer", header: "Producer" },
              { key: "region", header: "Region" },
              { key: "quantity", header: "Quantity" },
              { key: "unit", header: "Unit" },
              { key: "grade", header: "Grade" },
              { key: "status", header: "Status" },
              { key: "harvested_at", header: "Harvested" },
            ])
          }
        />
      }
    >
      <DataTable
        columns={columns}
        rows={query.items}
        getRowKey={(h) => h.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        emptyTitle="No harvests"
        emptyDescription="Harvested commodity lots will appear here once recorded."
        sort={sort}
        onSortChange={(s) => params.toggleSort(s.id)}
        stickyHeader
      />
      <Pagination page={params.page} limit={params.limit} total={query.total} onPageChange={params.setPage} />
    </ResourceListView>
  );
}

export default function HarvestsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading harvests…" />}>
      <HarvestsInner />
    </Suspense>
  );
}
