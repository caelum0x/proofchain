"use client";

import { useMemo, useState } from "react";
import { shortenHex, formatTokenAmount } from "@/lib/format";
import type { NetworkStats } from "@/lib/api";
import type { ActivityItem } from "@/hooks/overviewActivity";
import { useReports, REPORT_OPTIONS, type ReportKind } from "@/hooks/systemReports";
import { PageHeader, AsyncBoundary } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Callout } from "@/components/ui/Callout";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { BarChart, DonutChart, type DonutSlice } from "@/components/ui/Charts";
import { StatusBadge } from "@/components/ui/StatusBadge";

const USDC_DECIMALS = 6;

const KIND_LABEL: Record<string, string> = {
  registered: "Registered",
  checkpoint: "Checkpoint",
  attested: "Attested",
  funded: "Funded",
  released: "Released",
  disputed: "Disputed",
  refunded: "Refunded",
};

const DONUT_COLORS = ["text-info", "text-brand", "text-success", "text-warn", "text-danger", "text-dpp", "text-logistics"];

function count(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? "—" : value.toLocaleString();
}

function usd(value: NetworkStats["totalValueSettled"]): string {
  if (value === undefined) return "—";
  if (typeof value === "number") return `$${value.toLocaleString()}`;
  if (/^\d+$/.test(value)) return `$${formatTokenAmount(BigInt(value), USDC_DECIMALS, 2)}`;
  return "—";
}

/**
 * System → Reports (WD §3 Dashboard body): analytics KPIs, event charts, and an
 * exportable report table sourced from the backend analytics API + on-chain
 * activity stream.
 */
export function ReportsDashboard() {
  const { stats, activity, isLoading, apiError, chainError, refetch, rowsFor, exportCsv } = useReports();
  const [kind, setKind] = useState<ReportKind>("activity");

  const rows = useMemo(() => rowsFor(kind), [rowsFor, kind]);

  const byKind = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of activity) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    return [...counts.entries()].map(([k, v]) => ({ x: KIND_LABEL[k] ?? k, y: v }));
  }, [activity]);

  const donut = useMemo<readonly DonutSlice[]>(
    () => byKind.map((d, i) => ({ label: d.x, value: d.y, colorClassName: DONUT_COLORS[i % DONUT_COLORS.length] })),
    [byKind],
  );

  const columns: readonly Column<ActivityItem>[] = [
    { id: "event", header: "Event", cell: (r) => <StatusBadge status="neutral" dot={false}>{r.title}</StatusBadge> },
    { id: "detail", header: "Detail", className: "hidden md:table-cell", cell: (r) => (r.detail ? <span className="text-fg/80">{r.detail}</span> : <span className="text-faint">—</span>) },
    { id: "block", header: "Block", align: "right", className: "hidden sm:table-cell", cell: (r) => <span className="font-mono text-xs tabular-nums text-muted">{r.blockNumber.toString()}</span> },
    { id: "batch", header: "Batch", align: "right", cell: (r) => <span className="font-mono text-xs tabular-nums text-muted">{shortenHex(r.batchId, 5, 4)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="reports"
        title="Reports"
        subtitle="Operational analytics and exportable activity reports across the protocol."
        breadcrumbs={[{ label: "System" }, { label: "Reports" }]}
        actions={
          <Button variant="secondary" size="sm" onClick={refetch}>
            <Icon name="activity" size={16} />
            Refresh
          </Button>
        }
      />

      {apiError ? (
        <Callout tone="warn" title="Analytics API unavailable">
          Aggregate figures fall back to placeholders. On-chain event reports below remain available.
          <span className="mt-1 block text-xs text-muted">{apiError}</span>
        </Callout>
      ) : null}

      <KpiRow
        loading={isLoading}
        items={[
          { label: "Batches", value: count(stats.totalBatches) },
          { label: "Escrow deals", value: count(stats.totalDeals) },
          { label: "Value settled", value: usd(stats.totalValueSettled), hintTone: "success" },
          { label: "Financed", value: usd(stats.totalFinanced), hintTone: "brand" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Events by type" description="Distribution of lifecycle events on-chain." />
          <AsyncBoundary
            isLoading={isLoading}
            error={chainError}
            onRetry={refetch}
            isEmpty={byKind.length === 0}
            emptyTitle="No events yet"
            emptyDescription="Charts populate as protocol activity is indexed."
          >
            <BarChart data={byKind} height={160} colorClassName="text-brand" ariaLabel="Events by type" />
          </AsyncBoundary>
        </Card>

        <Card>
          <CardHeader title="Category split" description="Share of events by category." />
          <AsyncBoundary
            isLoading={isLoading}
            error={chainError}
            onRetry={refetch}
            isEmpty={donut.length === 0}
            emptyTitle="No events yet"
          >
            <div className="flex items-center gap-6">
              <DonutChart slices={donut} ariaLabel="Category split" />
              <ul className="space-y-1.5 text-sm">
                {donut.map((s) => (
                  <li key={s.label} className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full bg-current ${s.colorClassName}`} aria-hidden="true" />
                    <span className="text-fg/80">{s.label}</span>
                    <span className="font-mono tabular-nums text-muted">{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </AsyncBoundary>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Report data"
          description="Select a report and export the underlying rows as CSV."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label="Report type"
                options={REPORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={kind}
                onChange={(e) => setKind(e.target.value as ReportKind)}
              />
              <Button size="sm" onClick={() => exportCsv(kind)} disabled={rows.length === 0}>
                <Icon name="download" size={16} />
                Export CSV
              </Button>
            </div>
          }
        />
        <DataTable
          columns={columns}
          rows={rows.slice(0, 25)}
          getRowKey={(r) => `${r.transactionHash}-${r.logIndex}`}
          isLoading={isLoading}
          error={chainError}
          onRetry={refetch}
          emptyTitle="No rows for this report"
          emptyDescription="Try a different report type or refresh once activity is indexed."
        />
        {rows.length > 25 ? (
          <p className="mt-3 text-xs text-muted">
            Showing 25 of {rows.length.toLocaleString()} rows. Export CSV for the full dataset.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
