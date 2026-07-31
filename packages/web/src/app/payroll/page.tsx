"use client";

import { Suspense, useMemo } from "react";
import { usePayrollRuns, type PayrollRun } from "@/hooks/useWorkforce";
import { useListParams } from "@/hooks/t5-useListParams";
import { ResourceListView } from "@/components/t5/ResourceListView";
import { SearchInput, SelectFilter, ExportButton } from "@/components/t5/Filters";
import { fmtDate, fmtNumber, statusTone, titleCase } from "@/components/t5/format";
import { apiQuery, toCsv } from "@/components/t5/table-utils";
import { DataTable, type Column, type SortState } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { LoadingState } from "@/components/ui/States";

const STATUS_OPTIONS = [
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "scheduled", label: "Scheduled" },
  { value: "failed", label: "Failed" },
];

function PayrollInner() {
  const params = useListParams({ facets: ["status"], defaultSort: "paid_at" });
  const status = params.facet("status");

  const query = usePayrollRuns(
    apiQuery({ q: params.q, sortId: params.sortId, sortDir: params.sortDir, page: params.page, limit: params.limit, extra: { status: status || undefined } }),
  );

  const columns = useMemo<readonly Column<PayrollRun>[]>(
    () => [
      { id: "worker", header: "Worker", cell: (r) => (r.worker ? <AddressBadge address={r.worker} /> : "—") },
      { id: "employer", header: "Employer", cell: (r) => (r.employer ? <AddressBadge address={r.employer} /> : "—") },
      { id: "amount", header: "Amount", align: "right", sortable: true, cell: (r) => <span className="font-mono">{fmtNumber(r.amount)}</span> },
      { id: "period", header: "Period", cell: (r) => <span className="text-muted">{r.period ?? "—"}</span> },
      { id: "status", header: "Status", cell: (r) => <StatusBadge status={statusTone(r.status)}>{titleCase(r.status)}</StatusBadge> },
      { id: "paid_at", header: "Paid", sortable: true, cell: (r) => <span className="text-muted">{fmtDate(r.paid_at)}</span> },
    ],
    [],
  );

  const sort: SortState | null = params.sortId ? { id: params.sortId, dir: params.sortDir } : null;
  const paid = query.items.filter((r) => r.status?.toLowerCase() === "paid").length;
  const workers = new Set(query.items.map((r) => r.worker).filter(Boolean)).size;

  return (
    <ResourceListView
      title="Payroll"
      subtitle="On-chain wage disbursements to workers, settled in stablecoins."
      breadcrumbs={[{ label: "Workforce" }, { label: "Payroll" }]}
      icon="payments"
      accentClassName="text-workforce"
      kpis={[
        { label: "Total runs", value: fmtNumber(query.total) },
        { label: "Paid (page)", value: fmtNumber(paid), hintTone: "success" },
        { label: "Workers (page)", value: fmtNumber(workers) },
        { label: "Employers (page)", value: fmtNumber(new Set(query.items.map((r) => r.employer).filter(Boolean)).size) },
      ]}
      kpisLoading={query.isLoading}
      toolbar={
        <>
          <SearchInput value={params.q} onChange={params.setQ} placeholder="Search worker or employer" />
          <SelectFilter label="Status" value={status} onChange={(v) => params.setFacet("status", v || null)} options={STATUS_OPTIONS} />
        </>
      }
      toolbarActions={
        <ExportButton
          filename="payroll.csv"
          disabled={query.items.length === 0}
          getCsv={() =>
            toCsv(query.items, [
              { key: "worker", header: "Worker" },
              { key: "employer", header: "Employer" },
              { key: "amount", header: "Amount" },
              { key: "period", header: "Period" },
              { key: "status", header: "Status" },
              { key: "paid_at", header: "Paid" },
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
        emptyTitle="No payroll runs"
        emptyDescription="Wage disbursements will appear here once payroll is executed on-chain."
        sort={sort}
        onSortChange={(s) => params.toggleSort(s.id)}
        stickyHeader
      />
      <Pagination page={params.page} limit={params.limit} total={query.total} onPageChange={params.setPage} />
    </ResourceListView>
  );
}

export default function PayrollPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading payroll…" />}>
      <PayrollInner />
    </Suspense>
  );
}
