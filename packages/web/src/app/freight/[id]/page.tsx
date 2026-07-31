"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import type { Hex } from "viem";
import { DetailShell } from "@/components/shells/DetailShell";
import { PageHeader } from "@/components/page";
import { Card, CardHeader } from "@/components/ui/Card";
import { AsyncBoundary } from "@/components/page/AsyncBoundary";
import { AreaChart, type SeriesPoint } from "@/components/ui/Charts";
import { MapPreview, type MapPoint } from "@/components/ui/MapPreview";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RequireWallet } from "@/components/RequireWallet";
import { CheckpointTimeline } from "@/components/t4/CheckpointTimeline";
import { TempBadge } from "@/components/t4/TempBadge";
import { PushCheckpointForm } from "@/components/t4/PushCheckpointForm";
import { PushEmissionsForm } from "@/components/t4/PushEmissionsForm";
import { toCelsius, isBreach, DEFAULT_TEMP_MIN_C, DEFAULT_TEMP_MAX_C, type TempWindow } from "@/components/t4/temp";
import { useShipment } from "@/hooks/logisticsCheckpoints";
import { getErrorMessage } from "@/lib/errors";
import { shortenHex } from "@/lib/format";

const WINDOW: TempWindow = { minC: DEFAULT_TEMP_MIN_C, maxC: DEFAULT_TEMP_MAX_C };

export default function FreightDetailPage() {
  const params = useParams<{ id: string }>();
  const batchId = (params?.id ?? "") as Hex;
  const { trail, emissions, isLoading, isError, error, refetch } = useShipment(batchId);

  const last = trail.length > 0 ? trail[trail.length - 1] : undefined;
  const breaches = useMemo(() => trail.filter((c) => isBreach(c.temp, WINDOW)).length, [trail]);

  const tempSeries = useMemo<SeriesPoint[]>(
    () => trail.map((c, i) => ({ x: i, y: Number(toCelsius(c.temp).toFixed(1)) })),
    [trail],
  );

  const mapPoints = useMemo<MapPoint[]>(() => {
    const n = trail.length;
    if (n === 0) return [];
    return trail.map((c, i) => ({
      x: n === 1 ? 0.5 : 0.08 + (i / (n - 1)) * 0.84,
      y: 0.5 + Math.sin(i * 1.2) * 0.25,
      label: c.location,
      kind: i === 0 ? "origin" : i === n - 1 ? "destination" : "checkpoint",
    }));
  }, [trail]);

  const rail = (
    <>
      <Card>
        <CardHeader title="Shipment" />
        <dl className="space-y-3 text-sm">
          <Row label="Shipment id">
            <span className="inline-flex items-center gap-1 font-mono text-xs">
              {shortenHex(batchId, 8, 8)}
              <CopyButton value={batchId} />
            </span>
          </Row>
          <Row label="Checkpoints">{trail.length}</Row>
          <Row label="Cold-chain">
            {breaches > 0 ? (
              <StatusBadge status="danger">{breaches} breach{breaches > 1 ? "es" : ""}</StatusBadge>
            ) : (
              <StatusBadge status="success">In range</StatusBadge>
            )}
          </Row>
          <Row label="Last location">{last?.location || "—"}</Row>
          <Row label="Last temp">{last ? <TempBadge temp={last.temp} /> : "—"}</Row>
          <Row label="Last keeper">{last ? <AddressBadge address={last.keeper} /> : "—"}</Row>
          <Row label="Emissions">{emissions !== undefined ? `${Number(emissions).toLocaleString()} g CO₂e` : "—"}</Row>
        </dl>
      </Card>
      <RequireWallet>
        <PushCheckpointForm defaultBatchId={batchId} onDone={refetch} />
        <PushEmissionsForm defaultBatchId={batchId} onDone={refetch} />
      </RequireWallet>
    </>
  );

  return (
    <DetailShell
      header={
        <PageHeader
          title="Shipment detail"
          subtitle={<span className="font-mono text-xs">{shortenHex(batchId, 10, 10)}</span>}
          icon="truck"
          accentClassName="text-logistics"
          breadcrumbs={[
            { label: "Logistics", href: "/logistics" },
            { label: "Freight", href: "/freight" },
            { label: shortenHex(batchId, 4, 4) },
          ]}
        />
      }
      rail={rail}
    >
      <AsyncBoundary
        isLoading={isLoading}
        error={isError ? getErrorMessage(error) : null}
        onRetry={refetch}
        isEmpty={trail.length === 0}
        emptyTitle="No checkpoints for this shipment"
        emptyDescription="This id has no recorded checkpoints yet. Record one from the right rail."
      >
        <Card>
          <CardHeader title="Route" description="Schematic checkpoint path (origin → destination)." />
          <MapPreview points={mapPoints} height={200} ariaLabel="Shipment route" />
        </Card>

        <Card>
          <CardHeader title="Cold-chain profile" description={`Temperature per checkpoint. Safe window ${WINDOW.minC}–${WINDOW.maxC}°C.`} />
          <AreaChart data={tempSeries} height={160} colorClassName={breaches > 0 ? "text-danger" : "text-logistics"} ariaLabel="Temperature profile" />
        </Card>

        <Card>
          <CardHeader title="Checkpoint trail" description="Every recorded stop with its temperature reading." />
          <CheckpointTimeline checkpoints={trail} window={WINDOW} />
        </Card>
      </AsyncBoundary>
    </DetailShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-right text-fg">{children}</dd>
    </div>
  );
}
