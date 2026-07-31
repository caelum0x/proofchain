"use client";

import { Suspense, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAttestationFeed, type AttestationFeedItem } from "@/hooks/provenanceAttestations";
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
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/States";
import { SearchInput } from "@/components/t1/SearchInput";
import { BatchIdCell } from "@/components/t1/BatchIdCell";
import { attestationStatus, PAGE_SIZE } from "@/components/t1/provenanceFormat";

type VerdictFilter = "all" | "pass" | "fail";

const VERDICT_OPTIONS = [
  { value: "all", label: "All verdicts" },
  { value: "pass", label: "Passed" },
  { value: "fail", label: "Failed" },
];

function AttestationsContent() {
  const router = useRouter();
  const q = useListQuery();
  const search = q.get("q");
  const verdict = (q.get("verdict", "all") as VerdictFilter) || "all";
  const page = Math.max(0, q.getNumber("page", 0));

  const { attestations, passThreshold, isLoading, isError, error, refetch } = useAttestationFeed();

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return attestations.filter((a) => {
      if (needle && !a.batchId.toLowerCase().includes(needle) && !a.agent.toLowerCase().includes(needle)) {
        return false;
      }
      if (verdict === "pass") return a.score >= passThreshold;
      if (verdict === "fail") return a.score < passThreshold;
      return true;
    });
  }, [attestations, search, verdict, passThreshold]);

  const pageItems = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  const passed = attestations.filter((a) => a.score >= passThreshold).length;
  const avg = attestations.length
    ? Math.round(attestations.reduce((sum, a) => sum + a.score, 0) / attestations.length)
    : 0;
  const agents = new Set(attestations.map((a) => a.agent.toLowerCase())).size;

  const kpis: readonly Kpi[] = [
    { label: "Attestations", value: attestations.length, loading: isLoading },
    { label: "Pass rate", value: attestations.length ? formatBps(Math.round((passed / attestations.length) * 10000)) : "—", hintTone: "success", loading: isLoading },
    { label: "Avg score", value: attestations.length ? formatBps(avg) : "—", hintTone: "brand", loading: isLoading },
    { label: "Agents", value: agents, hint: `threshold ${formatBps(passThreshold)}`, loading: isLoading },
  ];

  const columns: readonly Column<AttestationFeedItem>[] = [
    { id: "batch", header: "Batch", cell: (a) => <BatchIdCell batchId={a.batchId} href="/attestations" /> },
    {
      id: "verdict",
      header: "Verdict",
      cell: (a) => {
        const v = attestationStatus(true, a.score, passThreshold);
        return <StatusBadge status={v.status}>{v.label}</StatusBadge>;
      },
    },
    { id: "agent", header: "Agent", cell: (a) => <AddressBadge address={a.agent} /> },
    {
      id: "doc",
      header: "Verdict doc",
      align: "right",
      cell: (a) =>
        a.verdictURI ? (
          <span className="font-mono text-xs text-muted" title={a.verdictURI}>
            linked
          </span>
        ) : (
          <span className="text-xs text-faint">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="attestation"
        accentClassName="text-compliance"
        breadcrumbs={[{ label: "Provenance" }, { label: "Attestations" }]}
        title="Attestations"
        subtitle="Signed AI verdicts written on-chain for every verified batch."
      />

      <KpiRow items={kpis} />

      <Toolbar>
        <SearchInput
          value={search}
          onChange={(v) => q.set({ q: v, page: undefined })}
          ariaLabel="Search attestations"
          placeholder="Search by batch id or agent…"
        />
        <FilterBar>
          <Select
            options={VERDICT_OPTIONS}
            value={verdict}
            aria-label="Filter by verdict"
            onChange={(e) => q.set({ verdict: e.target.value === "all" ? undefined : e.target.value, page: undefined })}
            className="w-44"
          />
        </FilterBar>
        <span className="text-xs text-muted">{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
      </Toolbar>

      <DataTable
        columns={columns}
        rows={pageItems}
        getRowKey={(a) => `${a.transactionHash}-${a.logIndex}`}
        onRowClick={(a) => router.push(`/attestations/${a.batchId}`)}
        isLoading={isLoading}
        error={isError ? getErrorMessage(error) : null}
        onRetry={() => void refetch()}
        emptyTitle="No attestations yet"
        emptyDescription="Verdicts appear here once the verification agent attests a batch."
      />

      {!isLoading && !isError && filtered.length > PAGE_SIZE ? (
        <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onPageChange={(p) => q.set({ page: p === 0 ? undefined : p })} />
      ) : null}
    </div>
  );
}

export default function AttestationsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AttestationsContent />
    </Suspense>
  );
}
