"use client";

import { Suspense, useMemo } from "react";
import { useDataProducts, type DataProduct } from "@/hooks/useDataMarket";
import { useListParams } from "@/hooks/t5-useListParams";
import { ResourceListView } from "@/components/t5/ResourceListView";
import { SearchInput, SelectFilter, ExportButton } from "@/components/t5/Filters";
import { fmtDate, fmtNumber, fmtPrice, titleCase } from "@/components/t5/format";
import { apiQuery, toCsv } from "@/components/t5/table-utils";
import { CardGrid } from "@/components/ui/CardGrid";
import { DataTable, type Column, type SortState } from "@/components/ui/DataTable";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { ViewToggle } from "@/components/page/Toolbar";
import { Badge } from "@/components/ui/Badge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/States";

const CATEGORY_OPTIONS = [
  { value: "provenance", label: "Provenance" },
  { value: "pricing", label: "Pricing" },
  { value: "esg", label: "ESG" },
  { value: "logistics", label: "Logistics" },
];

function DataMarketInner() {
  const params = useListParams({ facets: ["category"], defaultView: "grid", defaultSort: "updated_at" });
  const category = params.facet("category");

  const query = useDataProducts(
    apiQuery({ q: params.q, sortId: params.sortId, sortDir: params.sortDir, page: params.page, limit: params.limit, extra: { category: category || undefined } }),
  );

  const columns = useMemo<readonly Column<DataProduct>[]>(
    () => [
      { id: "name", header: "Dataset", cell: (d) => <span className="font-medium text-fg">{d.name ?? "—"}</span> },
      { id: "provider", header: "Provider", cell: (d) => (d.provider ? <AddressBadge address={d.provider} /> : "—") },
      { id: "category", header: "Category", cell: (d) => <Badge tone="neutral">{titleCase(d.category)}</Badge> },
      { id: "access", header: "Access", cell: (d) => <span className="text-muted">{titleCase(d.access)}</span> },
      { id: "records", header: "Records", align: "right", sortable: true, cell: (d) => <span className="font-mono">{fmtNumber(d.records)}</span> },
      { id: "price", header: "Price", align: "right", sortable: true, cell: (d) => <span className="font-mono">{fmtPrice(d.price)}</span> },
      { id: "updated_at", header: "Updated", sortable: true, cell: (d) => <span className="text-muted">{fmtDate(d.updated_at)}</span> },
    ],
    [],
  );

  const sort: SortState | null = params.sortId ? { id: params.sortId, dir: params.sortDir } : null;

  return (
    <ResourceListView
      title="Data market"
      subtitle="Datasets and live feeds published for sale — provenance telemetry, price oracles, and ESG series."
      breadcrumbs={[{ label: "Markets" }, { label: "Data market" }]}
      icon="database"
      accentClassName="text-markets"
      kpis={[
        { label: "Datasets", value: fmtNumber(query.total) },
        { label: "Providers (page)", value: fmtNumber(new Set(query.items.map((d) => d.provider).filter(Boolean)).size) },
        { label: "Categories (page)", value: fmtNumber(new Set(query.items.map((d) => d.category).filter(Boolean)).size) },
      ]}
      kpisLoading={query.isLoading}
      toolbar={
        <>
          <SearchInput value={params.q} onChange={params.setQ} placeholder="Search datasets" />
          <SelectFilter label="Category" value={category} onChange={(v) => params.setFacet("category", v || null)} options={CATEGORY_OPTIONS} />
        </>
      }
      toolbarActions={
        <>
          <ViewToggle value={params.view} onChange={params.setView} />
          <ExportButton
            filename="data-market.csv"
            disabled={query.items.length === 0}
            getCsv={() =>
              toCsv(query.items, [
                { key: "name", header: "Dataset" },
                { key: "provider", header: "Provider" },
                { key: "category", header: "Category" },
                { key: "access", header: "Access" },
                { key: "records", header: "Records" },
                { key: "price", header: "Price" },
                { key: "updated_at", header: "Updated" },
              ])
            }
          />
        </>
      }
    >
      {params.view === "grid" ? (
        <CardGrid
          items={query.items}
          getKey={(d) => d.id}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={query.refetch}
          emptyTitle="No datasets"
          emptyDescription="Published datasets and feeds will appear here."
          renderItem={(d) => (
            <Card className="h-full">
              <div className="flex items-start justify-between gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-markets/10 text-markets">
                  <Icon name="database" size={18} />
                </span>
                <Badge tone="neutral">{titleCase(d.category)}</Badge>
              </div>
              <h3 className="mt-3 truncate text-sm font-semibold text-fg">{d.name ?? "—"}</h3>
              <p className="mt-1 text-xs text-muted">{fmtNumber(d.records)} records · {titleCase(d.access)}</p>
              <div className="mt-3 flex items-center justify-between">
                {d.provider ? <AddressBadge address={d.provider} /> : <span className="text-xs text-muted">—</span>}
                <span className="font-mono text-sm text-fg">{fmtPrice(d.price)}</span>
              </div>
            </Card>
          )}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={query.items}
          getRowKey={(d) => d.id}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={query.refetch}
          emptyTitle="No datasets"
          emptyDescription="Published datasets and feeds will appear here."
          sort={sort}
          onSortChange={(s) => params.toggleSort(s.id)}
          stickyHeader
        />
      )}
      <Pagination page={params.page} limit={params.limit} total={query.total} onPageChange={params.setPage} />
    </ResourceListView>
  );
}

export default function DataMarketPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading data market…" />}>
      <DataMarketInner />
    </Suspense>
  );
}
