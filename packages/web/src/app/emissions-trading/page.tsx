"use client";

import { useMemo, useState } from "react";
import { PageHeader, Toolbar } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { Card, CardHeader } from "@/components/ui/Card";
import { LineChart, type SeriesPoint } from "@/components/ui/Charts";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Callout } from "@/components/ui/Callout";
import { RequireWallet } from "@/components/RequireWallet";
import { SetEmissionRateForm } from "@/components/t4/SetEmissionRateForm";
import { useEmissionsController, useEmissionsRecords, type EmissionsRecordItem } from "@/hooks/sustainabilityEmissions";
import { getErrorMessage } from "@/lib/errors";
import { shortenHex } from "@/lib/format";

export default function EmissionsTradingPage() {
  const controller = useEmissionsController();
  const records = useEmissionsRecords();
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const rateSeries = useMemo<SeriesPoint[]>(
    () => [...controller.rateHistory].reverse().map((h) => ({ x: Number(h.epoch), y: Number(h.rate) })),
    [controller.rateHistory],
  );

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return records.records;
    return records.records.filter((r) => r.batchId.toLowerCase().includes(query));
  }, [records.records, q]);

  const totalMeasured = useMemo(() => records.records.reduce((s, r) => s + r.co2e, 0n), [records.records]);

  const columns: readonly Column<EmissionsRecordItem>[] = [
    { id: "batchId", header: "Batch", cell: (r) => <span className="font-mono text-xs">{shortenHex(r.batchId, 6, 6)}</span> },
    { id: "co2e", header: "CO₂e (g)", align: "right", cell: (r) => r.co2e.toLocaleString() },
    { id: "keeper", header: "Keeper", cell: (r) => <AddressBadge address={r.keeper} /> },
    { id: "block", header: "Block", align: "right", cell: (r) => <span className="font-mono text-xs text-muted">#{r.blockNumber.toString()}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emissions Trading"
        subtitle="The per-epoch emission cap and the measured CO₂e readings that flow into carbon settlement."
        icon="carbon"
        accentClassName="text-sustainability"
        breadcrumbs={[{ label: "Sustainability", href: "/esg" }, { label: "Emissions" }]}
        actions={<Button onClick={() => setDrawerOpen(true)}>Set cap</Button>}
      />

      <KpiRow
        loading={controller.isLoading}
        items={[
          { label: "Current cap", value: controller.currentRate !== undefined ? controller.currentRate.toLocaleString() : "—", hint: "units / epoch" },
          { label: "Epoch", value: controller.currentEpoch !== undefined ? `#${controller.currentEpoch.toString()}` : "—" },
          { label: "Max cap", value: controller.maxRate !== undefined ? controller.maxRate.toLocaleString() : "—" },
          { label: "Measured CO₂e", value: totalMeasured.toLocaleString(), hint: `${records.records.length} readings` },
        ]}
      />

      {controller.notDeployed ? (
        <Callout tone="info" title="EmissionsController not deployed">The emissions cap controller is not configured on this network.</Callout>
      ) : (
        <Card>
          <CardHeader title="Emission cap history" description="Cap set per epoch on the EmissionsController." />
          {rateSeries.length > 0 ? (
            <LineChart data={rateSeries} height={180} colorClassName="text-sustainability" ariaLabel="Emission cap history" />
          ) : (
            <p className="py-8 text-center text-sm text-muted">No cap changes recorded yet.</p>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title="Measured emissions" description="Per-batch CO₂e readings from the SustainabilityOracle." />
        <Toolbar className="mb-4">
          <Input aria-label="Search emissions" placeholder="Search by batch id…" className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
        </Toolbar>
        {records.notDeployed ? (
          <Callout tone="info" title="SustainabilityOracle not deployed">Measured emissions are unavailable on this network.</Callout>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(r) => `${r.transactionHash}-${r.batchId}`}
            isLoading={records.isLoading}
            error={records.isError ? getErrorMessage(records.error) : null}
            onRetry={records.refetch}
            emptyTitle="No emissions recorded yet"
            emptyDescription="CO₂e readings appear here as keepers report them."
          />
        )}
      </Card>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Set emission cap">
        <RequireWallet>
          <SetEmissionRateForm maxRate={controller.maxRate} onDone={() => { setDrawerOpen(false); controller.refetch(); }} />
        </RequireWallet>
      </Drawer>
    </div>
  );
}
