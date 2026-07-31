"use client";

import { Suspense, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBatches } from "@/hooks/useBatches";
import { useBatchStatuses } from "@/hooks/useBatchStatuses";
import { useOverviewMetrics } from "@/hooks/overviewMetrics";
import { useListQuery } from "@/hooks/overviewListQuery";
import { getErrorMessage } from "@/lib/errors";
import { formatBps } from "@/lib/format";
import { DealState, type BatchRegisteredEvent } from "@/lib/types";
import { PageHeader } from "@/components/page/PageHeader";
import { Toolbar, FilterBar, ViewToggle } from "@/components/page/Toolbar";
import { KpiRow, type Kpi } from "@/components/ui/KpiRow";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { CardGrid } from "@/components/ui/CardGrid";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/States";
import { SearchInput } from "./SearchInput";
import { BatchIdCell } from "./BatchIdCell";
import { attestationStatus, dealStatus, PAGE_SIZE } from "./provenanceFormat";

type StatusFilter = "all" | "attested" | "pending" | "settled" | "disputed";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "attested", label: "Attested" },
  { value: "pending", label: "Pending verification" },
  { value: "settled", label: "Settled" },
  { value: "disputed", label: "Disputed" },
];

const THRESHOLD = 7000;

export interface BatchListProps {
  /** Route prefix for detail links (e.g. "/batches" or "/explorer"). */
  readonly basePath: string;
  readonly breadcrumbLabel: string;
  readonly sectionLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly accentClassName?: string;
  readonly headerActions?: ReactNode;
}

function BatchListContent({
  basePath,
  breadcrumbLabel,
  sectionLabel,
  title,
  subtitle,
  accentClassName = "text-dpp",
  headerActions,
}: BatchListProps) {
  const router = useRouter();
  const q = useListQuery();
  const search = q.get("q");
  const status = (q.get("status", "all") as StatusFilter) || "all";
  const view = q.get("view", "table") === "grid" ? "grid" : "table";
  const page = Math.max(0, q.getNumber("page", 0));

  const { batches, isLoading, isError, error, refetch } = useBatches();
  const metrics = useOverviewMetrics();
  const batchIds = useMemo(() => batches.map((b) => b.batchId), [batches]);
  const { statuses } = useBatchStatuses(batchIds);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return batches.filter((b) => {
      if (needle && !b.batchId.toLowerCase().includes(needle) && !b.supplier.toLowerCase().includes(needle)) {
        return false;
      }
      const s = statuses.get(b.batchId.toLowerCase());
      switch (status) {
        case "attested":
          return Boolean(s?.attested);
        case "pending":
          return !s?.attested;
        case "settled":
          return s?.dealState === DealState.Released;
        case "disputed":
          return s?.dealState === DealState.Disputed;
        default:
          return true;
      }
    });
  }, [batches, search, status, statuses]);

  const pageItems = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  const kpis: readonly Kpi[] = [
    { label: "Registered batches", value: metrics.batches, loading: metrics.isLoading },
    { label: "Attested", value: metrics.attestations, hint: `${metrics.passed} passed`, hintTone: "success", loading: metrics.isLoading },
    { label: "Pass rate", value: metrics.attestations ? formatBps(metrics.passRateBps) : "—", hintTone: "brand", loading: metrics.isLoading },
    { label: "Checkpoints", value: metrics.checkpoints, loading: metrics.isLoading },
  ];

  const columns: readonly Column<BatchRegisteredEvent>[] = [
    { id: "batch", header: "Batch", cell: (b) => <BatchIdCell batchId={b.batchId} href={basePath} /> },
    { id: "supplier", header: "Supplier", cell: (b) => <AddressBadge address={b.supplier} /> },
    {
      id: "attestation",
      header: "Attestation",
      cell: (b) => {
        const s = statuses.get(b.batchId.toLowerCase());
        const v = attestationStatus(Boolean(s?.attested), s?.score, THRESHOLD);
        return <StatusBadge status={v.status}>{v.label}</StatusBadge>;
      },
    },
    {
      id: "settlement",
      header: "Settlement",
      cell: (b) => {
        const s = statuses.get(b.batchId.toLowerCase());
        const v = dealStatus(s?.dealState ?? DealState.None);
        return <StatusBadge status={v.status}>{v.label}</StatusBadge>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="batches"
        accentClassName={accentClassName}
        breadcrumbs={[{ label: sectionLabel }, { label: breadcrumbLabel }]}
        title={title}
        subtitle={subtitle}
        actions={headerActions}
      />

      <KpiRow items={kpis} />

      <Toolbar
        actions={<ViewToggle value={view} onChange={(m) => q.set({ view: m === "table" ? undefined : m })} />}
      >
        <SearchInput
          value={search}
          onChange={(v) => q.set({ q: v, page: undefined })}
          ariaLabel="Search batches"
          placeholder="Search by batch id or supplier…"
        />
        <FilterBar>
          <Select
            options={STATUS_OPTIONS}
            value={status}
            aria-label="Filter by status"
            onChange={(e) => q.set({ status: e.target.value === "all" ? undefined : e.target.value, page: undefined })}
            className="w-52"
          />
        </FilterBar>
        <span className="text-xs text-muted">{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
      </Toolbar>

      {view === "table" ? (
        <DataTable
          columns={columns}
          rows={pageItems}
          getRowKey={(b) => b.batchId}
          onRowClick={(b) => router.push(`${basePath}/${b.batchId}`)}
          isLoading={isLoading}
          error={isError ? getErrorMessage(error) : null}
          onRetry={() => void refetch()}
          emptyTitle="No batches found"
          emptyDescription="Try clearing filters, or register a batch to see it here live."
        />
      ) : (
        <CardGrid
          items={pageItems}
          getKey={(b) => b.batchId}
          isLoading={isLoading}
          error={isError ? getErrorMessage(error) : null}
          onRetry={() => void refetch()}
          emptyTitle="No batches found"
          emptyDescription="Try clearing filters, or register a batch to see it here live."
          renderItem={(b) => {
            const s = statuses.get(b.batchId.toLowerCase());
            const v = attestationStatus(Boolean(s?.attested), s?.score, THRESHOLD);
            const d = dealStatus(s?.dealState ?? DealState.None);
            return (
              <Link href={`${basePath}/${b.batchId}`}>
                <Card className="h-full transition-colors hover:border-brand/40">
                  <BatchIdCell batchId={b.batchId} copyable={false} />
                  <div className="mt-3">
                    <AddressBadge address={b.supplier} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge status={v.status}>{v.label}</StatusBadge>
                    <StatusBadge status={d.status}>{d.label}</StatusBadge>
                  </div>
                </Card>
              </Link>
            );
          }}
        />
      )}

      {!isLoading && !isError && filtered.length > PAGE_SIZE ? (
        <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onPageChange={(p) => q.set({ page: p === 0 ? undefined : p })} />
      ) : null}
    </div>
  );
}

/** Shared, URL-driven batch list used by both Explorer and Provenance → Batches. */
export function BatchList(props: BatchListProps) {
  return (
    <Suspense fallback={<LoadingState />}>
      <BatchListContent {...props} />
    </Suspense>
  );
}
