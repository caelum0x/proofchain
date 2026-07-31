"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useBatches } from "@/hooks/useBatches";
import { useBatchStatuses } from "@/hooks/useBatchStatuses";
import { useListQuery } from "@/hooks/overviewListQuery";
import { getErrorMessage } from "@/lib/errors";
import { DealState } from "@/lib/types";
import { PageHeader } from "@/components/page/PageHeader";
import { Toolbar, FilterBar } from "@/components/page/Toolbar";
import { KpiRow, type Kpi } from "@/components/ui/KpiRow";
import { CardGrid } from "@/components/ui/CardGrid";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/States";
import { SearchInput } from "@/components/t1/SearchInput";
import { PassportCard } from "@/components/t1/PassportCard";
import { PAGE_SIZE } from "@/components/t1/provenanceFormat";

type StatusFilter = "all" | "verified" | "pending";
const THRESHOLD = 7000;

const STATUS_OPTIONS = [
  { value: "all", label: "All passports" },
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending" },
];

function PassportsContent() {
  const q = useListQuery();
  const search = q.get("q");
  const status = (q.get("status", "all") as StatusFilter) || "all";
  const page = Math.max(0, q.getNumber("page", 0));

  const { batches, isLoading, isError, error, refetch } = useBatches();
  const batchIds = useMemo(() => batches.map((b) => b.batchId), [batches]);
  const { statuses } = useBatchStatuses(batchIds);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return batches.filter((b) => {
      if (needle && !b.batchId.toLowerCase().includes(needle) && !b.supplier.toLowerCase().includes(needle)) return false;
      const s = statuses.get(b.batchId.toLowerCase());
      if (status === "verified") return Boolean(s?.attested) && (s?.score ?? 0) >= THRESHOLD;
      if (status === "pending") return !s?.attested;
      return true;
    });
  }, [batches, search, status, statuses]);

  const pageItems = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  const verified = batches.filter((b) => {
    const s = statuses.get(b.batchId.toLowerCase());
    return Boolean(s?.attested) && (s?.score ?? 0) >= THRESHOLD;
  }).length;

  const kpis: readonly Kpi[] = [
    { label: "Passports", value: batches.length, loading: isLoading },
    { label: "Verified", value: verified, hintTone: "success", loading: isLoading },
    { label: "Pending", value: batches.length - verified, hintTone: "warn", loading: isLoading },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="passport"
        accentClassName="text-dpp"
        breadcrumbs={[{ label: "Provenance" }, { label: "Passports" }]}
        title="Digital Product Passports"
        subtitle="A verifiable passport for every registered batch — provenance, verification, and settlement in one view."
        actions={
          <Link href="/passports/scan">
            <Button size="sm">Scan / look up</Button>
          </Link>
        }
      />

      <KpiRow items={kpis} />

      <Toolbar>
        <SearchInput
          value={search}
          onChange={(v) => q.set({ q: v, page: undefined })}
          ariaLabel="Search passports"
          placeholder="Search by batch id or supplier…"
        />
        <FilterBar>
          <Select
            options={STATUS_OPTIONS}
            value={status}
            aria-label="Filter passports"
            onChange={(e) => q.set({ status: e.target.value === "all" ? undefined : e.target.value, page: undefined })}
            className="w-44"
          />
        </FilterBar>
        <span className="text-xs text-muted">{filtered.length} passport{filtered.length === 1 ? "" : "s"}</span>
      </Toolbar>

      <CardGrid
        items={pageItems}
        getKey={(b) => b.batchId}
        minColWidth={280}
        isLoading={isLoading}
        error={isError ? getErrorMessage(error) : null}
        onRetry={() => void refetch()}
        emptyTitle="No passports found"
        emptyDescription="Register a batch to mint its digital product passport."
        renderItem={(b) => {
          const s = statuses.get(b.batchId.toLowerCase());
          return (
            <PassportCard
              batchId={b.batchId}
              supplier={b.supplier}
              attested={Boolean(s?.attested)}
              score={s?.score}
              dealState={s?.dealState ?? DealState.None}
              threshold={THRESHOLD}
            />
          );
        }}
      />

      {!isLoading && !isError && filtered.length > PAGE_SIZE ? (
        <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onPageChange={(p) => q.set({ page: p === 0 ? undefined : p })} />
      ) : null}
    </div>
  );
}

export default function PassportsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <PassportsContent />
    </Suspense>
  );
}
