"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Hex } from "viem";
import { DetailShell } from "@/components/shells/DetailShell";
import { PageHeader } from "@/components/page";
import { AsyncBoundary } from "@/components/page/AsyncBoundary";
import { Card, CardHeader } from "@/components/ui/Card";
import { AreaChart, type SeriesPoint } from "@/components/ui/Charts";
import { MapPreview, type MapPoint } from "@/components/ui/MapPreview";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { RequireWallet } from "@/components/RequireWallet";
import { CheckpointTimeline } from "@/components/t4/CheckpointTimeline";
import { TempBadge } from "@/components/t4/TempBadge";
import { PushCheckpointForm } from "@/components/t4/PushCheckpointForm";
import { toCelsius, isBreach, DEFAULT_TEMP_MIN_C, DEFAULT_TEMP_MAX_C, type TempWindow } from "@/components/t4/temp";
import { useShipment } from "@/hooks/logisticsCheckpoints";
import { getErrorMessage } from "@/lib/errors";
import { shortenHex } from "@/lib/format";

const WINDOW: TempWindow = { minC: DEFAULT_TEMP_MIN_C, maxC: DEFAULT_TEMP_MAX_C };

export default function ContainerDetailPage() {
  const params = useParams<{ id: string }>();
  const containerId = (params?.id ?? "") as Hex;
  const { trail, isLoading, isError, error, refetch } = useShipment(containerId);

  const last = trail.length > 0 ? trail[trail.length - 1] : undefined;
  const breaches = useMemo(() => trail.filter((c) => isBreach(c.temp, WINDOW)).length, [trail]);
  const tempSeries = useMemo<SeriesPoint[]>(() => trail.map((c, i) => ({ x: i, y: Number(toCelsius(c.temp).toFixed(1)) })), [trail]);
  const mapPoints = useMemo<MapPoint[]>(() => {
    const n = trail.length;
    if (n === 0) return [];
    return trail.map((c, i) => ({
      x: n === 1 ? 0.5 : 0.08 + (i / (n - 1)) * 0.84,
      y: 0.5 + Math.cos(i * 1.1) * 0.25,
      label: c.location,
      kind: i === 0 ? "origin" : i === n - 1 ? "destination" : "checkpoint",
    }));
  }, [trail]);

  const rail = (
    <>
      <Card>
        <CardHeader title="Container" />
        <dl className="space-y-3 text-sm">
          <Row label="Container id">
            <span className="inline-flex items-center gap-1 font-mono text-xs">
              {shortenHex(containerId, 6, 6)}
              <CopyButton value={containerId} />
            </span>
          </Row>
          <Row label="Checkpoints">{trail.length}</Row>
          <Row label="Cold-chain">
            {breaches > 0 ? <StatusBadge status="danger">{breaches} breach{breaches > 1 ? "es" : ""}</StatusBadge> : <StatusBadge status="success">In range</StatusBadge>}
          </Row>
          <Row label="Last position">{last?.location || "—"}</Row>
          <Row label="Last temp">{last ? <TempBadge temp={last.temp} /> : "—"}</Row>
          <Row label="Last keeper">{last ? <AddressBadge address={last.keeper} /> : "—"}</Row>
        </dl>
        <div className="mt-4 border-t border-border pt-3">
          <Link href={`/freight/${containerId}`}><Button variant="secondary" size="sm">Open as shipment</Button></Link>
        </div>
      </Card>
      <RequireWallet>
        <PushCheckpointForm defaultBatchId={containerId} onDone={refetch} />
      </RequireWallet>
    </>
  );

  return (
    <DetailShell
      header={
        <PageHeader
          title="Container detail"
          subtitle={<span className="font-mono text-xs">{shortenHex(containerId, 10, 10)}</span>}
          icon="container"
          accentClassName="text-logistics"
          breadcrumbs={[
            { label: "Logistics", href: "/logistics" },
            { label: "Containers", href: "/containers" },
            { label: shortenHex(containerId, 4, 4) },
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
        emptyTitle="No checkpoints for this container"
        emptyDescription="This container id has no recorded checkpoints yet."
      >
        <Card>
          <CardHeader title="Route" description="Schematic checkpoint path." />
          <MapPreview points={mapPoints} height={200} ariaLabel="Container route" />
        </Card>
        <Card>
          <CardHeader title="Cold-chain profile" description={`Safe window ${WINDOW.minC}–${WINDOW.maxC}°C.`} />
          <AreaChart data={tempSeries} height={160} colorClassName={breaches > 0 ? "text-danger" : "text-logistics"} ariaLabel="Temperature profile" />
        </Card>
        <Card>
          <CardHeader title="Checkpoint trail" />
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
