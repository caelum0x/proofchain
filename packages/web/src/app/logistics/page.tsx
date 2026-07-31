"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { Card, CardHeader } from "@/components/ui/Card";
import { CardGrid } from "@/components/ui/CardGrid";
import { AreaChart, DonutChart, type SeriesPoint } from "@/components/ui/Charts";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Callout } from "@/components/ui/Callout";
import { useShipments } from "@/hooks/logisticsCheckpoints";
import { useWarehouseReceipts } from "@/hooks/logisticsWarehouses";
import { useCarriers } from "@/hooks/logisticsFleet";
import { isBreach, DEFAULT_TEMP_MIN_C, DEFAULT_TEMP_MAX_C, type TempWindow } from "@/components/t4/temp";

const WINDOW: TempWindow = { minC: DEFAULT_TEMP_MIN_C, maxC: DEFAULT_TEMP_MAX_C };

interface ModuleLink {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly icon: IconName;
}

const MODULES: readonly ModuleLink[] = [
  { href: "/freight", label: "Freight", description: "Live shipments and their checkpoint trails.", icon: "truck" },
  { href: "/cold-chain", label: "Cold Chain", description: "Temperature readings and breach monitoring.", icon: "water" },
  { href: "/warehouses", label: "Warehouses", description: "Tokenized warehouse receipts.", icon: "warehouse" },
  { href: "/fleet", label: "Fleet", description: "Registered carriers and operators.", icon: "truck" },
  { href: "/proof-of-delivery", label: "Proof of Delivery", description: "Delivery confirmations with evidence.", icon: "delivery" },
];

export default function LogisticsOverviewPage() {
  const shipments = useShipments();
  const receipts = useWarehouseReceipts();
  const carriers = useCarriers();

  const totalCheckpoints = useMemo(
    () => shipments.shipments.reduce((sum, s) => sum + s.checkpoints, 0),
    [shipments.shipments],
  );

  const { breaches, ok } = useMemo(() => {
    let b = 0;
    let o = 0;
    for (const s of shipments.shipments) {
      if (isBreach(s.lastTemp, WINDOW)) b += 1;
      else o += 1;
    }
    return { breaches: b, ok: o };
  }, [shipments.shipments]);

  const activity = useMemo<SeriesPoint[]>(() => {
    const sorted = [...shipments.shipments].reverse();
    if (sorted.length === 0) return [];
    return sorted.slice(-16).map((s, i) => ({ x: i, y: s.checkpoints }));
  }, [shipments.shipments]);

  const loading = shipments.isLoading || receipts.isLoading || carriers.isLoading;
  const notDeployed = shipments.notDeployed;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logistics"
        subtitle="Freight, cold-chain integrity, warehousing, and delivery proof across the supply chain."
        icon="logistics"
        accentClassName="text-logistics"
        breadcrumbs={[{ label: "Logistics" }]}
      />

      {notDeployed ? (
        <Callout tone="info" title="Logistics contracts not deployed on this network">
          The CheckpointOracle and related registries are not configured on the active network. Connect to a network where they are live to see shipment data.
        </Callout>
      ) : null}

      <KpiRow
        loading={loading}
        items={[
          { label: "Active shipments", value: shipments.shipments.length.toLocaleString(), hint: "with checkpoints" },
          { label: "Checkpoints", value: totalCheckpoints.toLocaleString(), hint: "IoT + location" },
          { label: "Warehouse receipts", value: receipts.receipts.length.toLocaleString(), hint: "tokenized" },
          { label: "Carriers", value: carriers.carriers.length.toLocaleString(), hint: "registered" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Checkpoint activity" description="Checkpoints recorded per recent shipment." />
          <AreaChart data={activity} height={180} colorClassName="text-logistics" ariaLabel="Checkpoint activity" />
        </Card>
        <Card className="flex flex-col items-center justify-center gap-4">
          <div className="self-stretch">
            <CardHeader title="Cold-chain integrity" description="Latest reading per shipment." />
          </div>
          <DonutChart
            slices={[
              { label: "In range", value: ok, colorClassName: "text-success" },
              { label: "Breached", value: breaches, colorClassName: "text-danger" },
            ]}
            ariaLabel="Cold-chain integrity split"
          />
          <div className="flex gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" />In range {ok}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-danger" />Breached {breaches}</span>
          </div>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">Modules</h2>
        <CardGrid
          items={MODULES}
          getKey={(m) => m.href}
          renderItem={(m) => (
            <Link href={m.href} className="block h-full">
              <Card className="h-full transition-colors hover:border-logistics/50">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-logistics">
                    <Icon name={m.icon} size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-fg">{m.label}</p>
                    <p className="mt-0.5 text-sm text-muted">{m.description}</p>
                  </div>
                </div>
              </Card>
            </Link>
          )}
        />
      </div>
    </div>
  );
}
