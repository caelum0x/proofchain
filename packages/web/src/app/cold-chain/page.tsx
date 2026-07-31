"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Toolbar, FilterBar, SearchParamsBoundary } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Callout } from "@/components/ui/Callout";
import { TempBadge } from "@/components/t4/TempBadge";
import { toCelsius, isBreach, DEFAULT_TEMP_MIN_C, DEFAULT_TEMP_MAX_C, type TempWindow } from "@/components/t4/temp";
import { useCheckpoints, type CheckpointItem } from "@/hooks/logisticsCheckpoints";
import { useT4ListState } from "@/hooks/t4UrlListState";
import { getErrorMessage } from "@/lib/errors";
import { shortenHex } from "@/lib/format";

const PAGE_SIZE = 12;

function ColdChainPageContent() {
  const router = useRouter();
  const { checkpoints, isLoading, isError, error, notDeployed, refetch } = useCheckpoints();
  const url = useT4ListState();

  const window: TempWindow = {
    minC: numOr(url.get("min"), DEFAULT_TEMP_MIN_C),
    maxC: numOr(url.get("max"), DEFAULT_TEMP_MAX_C),
  };
  const breachOnly = url.get("filter") === "breach";

  const stats = useMemo(() => {
    if (checkpoints.length === 0) return { count: 0, breaches: 0, min: 0, max: 0, avg: 0 };
    const temps = checkpoints.map((c) => toCelsius(c.temp));
    const breaches = checkpoints.filter((c) => isBreach(c.temp, window)).length;
    return {
      count: checkpoints.length,
      breaches,
      min: Math.min(...temps),
      max: Math.max(...temps),
      avg: temps.reduce((a, b) => a + b, 0) / temps.length,
    };
  }, [checkpoints, window.minC, window.maxC]);

  const filtered = useMemo(() => {
    const q = url.q.trim().toLowerCase();
    return checkpoints.filter((c) => {
      if (breachOnly && !isBreach(c.temp, window)) return false;
      if (q && !c.location.toLowerCase().includes(q) && !c.batchId.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [checkpoints, url.q, breachOnly, window.minC, window.maxC]);

  const page = Math.min(url.page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const columns: readonly Column<CheckpointItem>[] = [
    { id: "batchId", header: "Shipment", cell: (c) => <span className="font-mono text-xs">{shortenHex(c.batchId, 5, 5)}</span> },
    { id: "location", header: "Location", cell: (c) => c.location || "—" },
    { id: "temp", header: "Temp", cell: (c) => <TempBadge temp={c.temp} window={window} /> },
    {
      id: "status",
      header: "Status",
      cell: (c) =>
        isBreach(c.temp, window) ? (
          <StatusBadge status="danger">Breach</StatusBadge>
        ) : (
          <StatusBadge status="success">In range</StatusBadge>
        ),
    },
    { id: "keeper", header: "Keeper", cell: (c) => <AddressBadge address={c.keeper} /> },
    { id: "block", header: "Block", align: "right", cell: (c) => <span className="font-mono text-xs text-muted">#{c.blockNumber.toString()}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cold Chain"
        subtitle="Temperature integrity across every shipment checkpoint, with breach detection."
        icon="water"
        accentClassName="text-logistics"
        breadcrumbs={[{ label: "Logistics", href: "/logistics" }, { label: "Cold Chain" }]}
      />

      <KpiRow
        loading={isLoading}
        items={[
          { label: "Readings", value: stats.count.toLocaleString() },
          { label: "Breaches", value: stats.breaches.toLocaleString(), hint: `outside ${window.minC}–${window.maxC}°C`, hintTone: stats.breaches > 0 ? "danger" : "success" },
          { label: "Avg temp", value: `${stats.avg.toFixed(1)}°C` },
          { label: "Range", value: `${stats.min.toFixed(1)} – ${stats.max.toFixed(1)}°C` },
        ]}
      />

      <Toolbar
        actions={
          <FilterBar>
            <Input aria-label="Min °C" type="number" step="0.5" className="w-24" placeholder="min °C" value={url.get("min") ?? ""} onChange={(e) => url.setParams({ min: e.target.value })} />
            <Input aria-label="Max °C" type="number" step="0.5" className="w-24" placeholder="max °C" value={url.get("max") ?? ""} onChange={(e) => url.setParams({ max: e.target.value })} />
            <Select
              aria-label="Filter readings"
              className="w-40"
              value={breachOnly ? "breach" : "all"}
              onChange={(e) => url.setParams({ filter: e.target.value === "breach" ? "breach" : null })}
              options={[
                { value: "all", label: "All readings" },
                { value: "breach", label: "Breaches only" },
              ]}
            />
          </FilterBar>
        }
      >
        <Input
          aria-label="Search readings"
          placeholder="Search by location or shipment…"
          className="max-w-xs"
          value={url.q}
          onChange={(e) => url.setParams({ q: e.target.value })}
        />
      </Toolbar>

      {stats.breaches > 0 && !breachOnly ? (
        <Callout tone="warn" title={`${stats.breaches} cold-chain breach${stats.breaches > 1 ? "es" : ""} detected`}>
          Some readings fall outside the {window.minC}–{window.maxC}°C safe window. Filter to breaches only to investigate.
        </Callout>
      ) : null}

      {notDeployed ? (
        <Callout tone="info" title="CheckpointOracle not deployed">
          Cold-chain monitoring is unavailable on this network.
        </Callout>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={paged}
            getRowKey={(c) => `${c.transactionHash}-${c.logIndex}`}
            onRowClick={(c) => router.push(`/freight/${c.batchId}`)}
            isLoading={isLoading}
            error={isError ? getErrorMessage(error) : null}
            onRetry={refetch}
            emptyTitle="No readings"
            emptyDescription="Temperature readings appear as keepers push checkpoints."
          />
          {filtered.length > PAGE_SIZE ? (
            <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onPageChange={url.setPage} />
          ) : null}
        </>
      )}
    </div>
  );
}

function numOr(value: string | null, fallback: number): number {
  const n = value !== null && value !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export default function ColdChainPage() {
  return (
    <SearchParamsBoundary>
      <ColdChainPageContent />
    </SearchParamsBoundary>
  );
}
