"use client";

import { Suspense, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCommodities, type Commodity } from "@/hooks/useCommodities";
import { useListParams } from "@/hooks/t5-useListParams";
import { ResourceListView } from "@/components/t5/ResourceListView";
import { SearchInput, SelectFilter, ExportButton } from "@/components/t5/Filters";
import { fmtChange, fmtNumber, fmtPrice, changeTone, titleCase } from "@/components/t5/format";
import { apiQuery, toCsv } from "@/components/t5/table-utils";
import { DataTable, type Column, type SortState } from "@/components/ui/DataTable";
import { CardGrid } from "@/components/ui/CardGrid";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { ViewToggle } from "@/components/page/Toolbar";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/States";
import { cn } from "@/lib/cn";

const CATEGORY_OPTIONS = [
  { value: "agriculture", label: "Agriculture" },
  { value: "metals", label: "Metals" },
  { value: "energy", label: "Energy" },
  { value: "softs", label: "Softs" },
];

function changeClass(value?: string | number): string {
  const tone = changeTone(value);
  return tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-muted";
}

function CommoditiesInner() {
  const router = useRouter();
  const params = useListParams({ facets: ["category"], defaultSort: "volume_24h" });
  const category = params.facet("category");

  const query = useCommodities(
    apiQuery({ q: params.q, sortId: params.sortId, sortDir: params.sortDir, page: params.page, limit: params.limit, extra: { category: category || undefined } }),
  );

  const columns = useMemo<readonly Column<Commodity>[]>(
    () => [
      { id: "symbol", header: "Symbol", cell: (c) => <span className="font-mono font-semibold text-fg">{c.symbol}</span> },
      { id: "name", header: "Name", cell: (c) => c.name ?? "—" },
      { id: "category", header: "Category", cell: (c) => <Badge tone="neutral">{titleCase(c.category)}</Badge> },
      { id: "reference_price", header: "Price", align: "right", sortable: true, cell: (c) => <span className="font-mono">{fmtPrice(c.reference_price)}</span> },
      { id: "change_24h", header: "24h", align: "right", sortable: true, cell: (c) => <span className={cn("font-mono", changeClass(c.change_24h))}>{fmtChange(c.change_24h)}</span> },
      { id: "volume_24h", header: "Volume", align: "right", sortable: true, cell: (c) => <span className="font-mono text-muted">{fmtNumber(c.volume_24h)}</span> },
    ],
    [],
  );

  const sort: SortState | null = params.sortId ? { id: params.sortId, dir: params.sortDir } : null;

  return (
    <ResourceListView
      title="Commodities"
      subtitle="Reference prices and market data for tokenized physical commodities."
      breadcrumbs={[{ label: "Markets" }, { label: "Commodities" }]}
      icon="commodities"
      accentClassName="text-markets"
      kpis={[
        { label: "Tracked symbols", value: fmtNumber(query.total) },
        { label: "Categories (page)", value: fmtNumber(new Set(query.items.map((c) => c.category).filter(Boolean)).size) },
        { label: "Advancing (page)", value: fmtNumber(query.items.filter((c) => changeTone(c.change_24h) === "success").length), hintTone: "success" },
        { label: "Declining (page)", value: fmtNumber(query.items.filter((c) => changeTone(c.change_24h) === "danger").length), hintTone: "danger" },
      ]}
      kpisLoading={query.isLoading}
      toolbar={
        <>
          <SearchInput value={params.q} onChange={params.setQ} placeholder="Search symbol or name" />
          <SelectFilter label="Category" value={category} onChange={(v) => params.setFacet("category", v || null)} options={CATEGORY_OPTIONS} />
        </>
      }
      toolbarActions={
        <>
          <ViewToggle value={params.view} onChange={params.setView} />
          <ExportButton
            filename="commodities.csv"
            disabled={query.items.length === 0}
            getCsv={() =>
              toCsv(query.items, [
                { key: "symbol", header: "Symbol" },
                { key: "name", header: "Name" },
                { key: "category", header: "Category" },
                { key: "reference_price", header: "Price" },
                { key: "change_24h", header: "24h" },
                { key: "volume_24h", header: "Volume" },
              ])
            }
          />
        </>
      }
    >
      {params.view === "grid" ? (
        <CardGrid
          items={query.items}
          getKey={(c) => c.symbol}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={query.refetch}
          emptyTitle="No commodities"
          emptyDescription="Tracked commodity markets will appear here."
          renderItem={(c) => (
            <Link href={`/commodities/${encodeURIComponent(c.symbol)}`} className="group block">
              <Card className="h-full transition-colors group-hover:border-markets/50">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-lg font-semibold text-fg">{c.symbol}</p>
                    <p className="text-sm text-muted">{c.name ?? "—"}</p>
                  </div>
                  <Badge tone="neutral">{titleCase(c.category)}</Badge>
                </div>
                <div className="mt-4 flex items-baseline justify-between">
                  <span className="font-mono text-xl text-fg">{fmtPrice(c.reference_price)}</span>
                  <span className={cn("font-mono text-sm", changeClass(c.change_24h))}>{fmtChange(c.change_24h)}</span>
                </div>
              </Card>
            </Link>
          )}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={query.items}
          getRowKey={(c) => c.symbol}
          onRowClick={(c) => router.push(`/commodities/${encodeURIComponent(c.symbol)}`)}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={query.refetch}
          emptyTitle="No commodities"
          emptyDescription="Tracked commodity markets will appear here."
          sort={sort}
          onSortChange={(s) => params.toggleSort(s.id)}
          stickyHeader
        />
      )}
      <Pagination page={params.page} limit={params.limit} total={query.total} onPageChange={params.setPage} />
    </ResourceListView>
  );
}

export default function CommoditiesPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading commodities…" />}>
      <CommoditiesInner />
    </Suspense>
  );
}
