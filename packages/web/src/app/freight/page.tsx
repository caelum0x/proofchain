"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Toolbar, SearchParamsBoundary } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { DataTable, type Column, type SortState } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Pagination } from "@/components/ui/Pagination";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Callout } from "@/components/ui/Callout";
import { RequireWallet } from "@/components/RequireWallet";
import { TempBadge } from "@/components/t4/TempBadge";
import { PushCheckpointForm } from "@/components/t4/PushCheckpointForm";
import { useShipments, type ShipmentItem } from "@/hooks/logisticsCheckpoints";
import { useT4ListState } from "@/hooks/t4UrlListState";
import { getErrorMessage } from "@/lib/errors";
import { shortenHex } from "@/lib/format";

const PAGE_SIZE = 10;

function FreightPageContent() {
  const router = useRouter();
  const { shipments, isLoading, isError, error, notDeployed, refetch } = useShipments();
  const url = useT4ListState({ sort: "lastBlock", dir: "desc" });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = url.q.trim().toLowerCase();
    let rows = shipments;
    if (q) {
      rows = rows.filter(
        (s) => s.batchId.toLowerCase().includes(q) || s.lastLocation.toLowerCase().includes(q),
      );
    }
    const dir = url.dir === "asc" ? 1 : -1;
    const sorted = [...rows].sort((a, b) => {
      switch (url.sort) {
        case "checkpoints":
          return (a.checkpoints - b.checkpoints) * dir;
        case "location":
          return a.lastLocation.localeCompare(b.lastLocation) * dir;
        default:
          return (a.lastBlock > b.lastBlock ? 1 : a.lastBlock < b.lastBlock ? -1 : 0) * dir;
      }
    });
    return sorted;
  }, [shipments, url.q, url.sort, url.dir]);

  const page = Math.min(url.page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const sort: SortState | null = url.sort ? { id: url.sort, dir: url.dir } : null;

  const columns: readonly Column<ShipmentItem>[] = [
    {
      id: "batchId",
      header: "Shipment",
      cell: (s) => <span className="font-mono text-xs">{shortenHex(s.batchId, 6, 6)}</span>,
    },
    { id: "checkpoints", header: "Checkpoints", align: "right", sortable: true, cell: (s) => s.checkpoints },
    { id: "location", header: "Last location", sortable: true, cell: (s) => s.lastLocation || "—" },
    { id: "temp", header: "Temp", cell: (s) => <TempBadge temp={s.lastTemp} /> },
    { id: "keeper", header: "Last keeper", cell: (s) => <AddressBadge address={s.lastKeeper} /> },
    { id: "lastBlock", header: "Updated", align: "right", sortable: true, cell: (s) => <span className="font-mono text-xs text-muted">#{s.lastBlock.toString()}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Freight"
        subtitle="Every shipment reconstructed from its on-chain checkpoint trail."
        icon="truck"
        accentClassName="text-logistics"
        breadcrumbs={[{ label: "Logistics", href: "/logistics" }, { label: "Freight" }]}
        actions={<Button onClick={() => setDrawerOpen(true)}>Push checkpoint</Button>}
      />

      <KpiRow
        loading={isLoading}
        items={[
          { label: "Shipments", value: shipments.length.toLocaleString() },
          { label: "Checkpoints", value: shipments.reduce((n, s) => n + s.checkpoints, 0).toLocaleString() },
          { label: "In transit", value: shipments.filter((s) => s.checkpoints > 0).length.toLocaleString(), hint: "with activity" },
          { label: "Filtered", value: filtered.length.toLocaleString(), hint: url.q ? `“${url.q}”` : "all" },
        ]}
      />

      <Toolbar>
        <Input
          aria-label="Search shipments"
          placeholder="Search by shipment id or location…"
          className="max-w-xs"
          value={url.q}
          onChange={(e) => url.setParams({ q: e.target.value })}
        />
      </Toolbar>

      {notDeployed ? (
        <Callout tone="info" title="CheckpointOracle not deployed">
          Freight tracking is unavailable on this network because the CheckpointOracle contract is not configured.
        </Callout>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={paged}
            getRowKey={(s) => s.batchId}
            onRowClick={(s) => router.push(`/freight/${s.batchId}`)}
            isLoading={isLoading}
            error={isError ? getErrorMessage(error) : null}
            onRetry={refetch}
            sort={sort}
            onSortChange={(next) => url.setParams({ sort: next.id, dir: next.dir })}
            emptyTitle="No shipments yet"
            emptyDescription="Shipments appear here as carriers push checkpoints on-chain."
          />
          {filtered.length > PAGE_SIZE ? (
            <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onPageChange={url.setPage} />
          ) : null}
        </>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Record a checkpoint">
        <RequireWallet>
          <PushCheckpointForm onDone={() => { setDrawerOpen(false); refetch(); }} />
        </RequireWallet>
      </Drawer>
    </div>
  );
}

export default function FreightPage() {
  return (
    <SearchParamsBoundary>
      <FreightPageContent />
    </SearchParamsBoundary>
  );
}
