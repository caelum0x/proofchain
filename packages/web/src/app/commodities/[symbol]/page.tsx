"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCommodity } from "@/hooks/useCommodities";
import { useHarvests } from "@/hooks/useHarvests";
import { DetailShell } from "@/components/shells/DetailShell";
import { PageHeader } from "@/components/page/PageHeader";
import { InfoCard } from "@/components/t5/DefinitionList";
import { fmtChange, fmtNumber, fmtPrice, changeTone, titleCase, fmtDate, toNumber, statusTone } from "@/components/t5/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { AreaChart, type SeriesPoint } from "@/components/ui/Charts";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingState, ErrorState } from "@/components/ui/States";
import type { Harvest } from "@/hooks/useHarvests";

export default function CommodityDetailPage() {
  const routeParams = useParams<{ symbol: string }>();
  const raw = Array.isArray(routeParams.symbol) ? routeParams.symbol[0] : routeParams.symbol;
  const symbol = raw ? decodeURIComponent(raw) : undefined;

  const { data, isLoading, error, refetch } = useCommodity(symbol);
  const harvests = useHarvests({ commodity: symbol, limit: 5 });

  const series = useMemo<readonly SeriesPoint[]>(
    () => (data?.history ?? []).map((point, index) => ({ x: index, y: toNumber(point.price) ?? 0 })),
    [data?.history],
  );

  const harvestColumns = useMemo<readonly Column<Harvest>[]>(
    () => [
      { id: "producer", header: "Producer", cell: (h) => (h.producer ? <AddressBadge address={h.producer} /> : "—") },
      { id: "region", header: "Region", cell: (h) => h.region ?? "—" },
      { id: "quantity", header: "Quantity", align: "right", cell: (h) => <span className="font-mono">{fmtNumber(h.quantity)} {h.unit ?? ""}</span> },
      { id: "status", header: "Status", cell: (h) => <StatusBadge status={statusTone(h.status)}>{titleCase(h.status)}</StatusBadge> },
      { id: "harvested_at", header: "Harvested", cell: (h) => <span className="text-muted">{fmtDate(h.harvested_at)}</span> },
    ],
    [],
  );

  if (!symbol) {
    return <ErrorState title="Invalid symbol" message="The URL does not contain a commodity symbol." />;
  }

  const changeT = changeTone(data?.change_24h);

  return (
    <DetailShell
      header={
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              <span className="font-mono">{symbol}</span>
              {data?.name ? <span className="text-lg font-normal text-muted">{data.name}</span> : null}
            </span>
          }
          subtitle="Reference market, price history, and linked harvests."
          breadcrumbs={[{ label: "Markets" }, { label: "Commodities", href: "/commodities" }, { label: symbol }]}
          icon="commodities"
          accentClassName="text-markets"
          actions={
            <Link href="/commodities">
              <Button variant="secondary" size="sm">
                All commodities
              </Button>
            </Link>
          }
        />
      }
      rail={
        <>
          <InfoCard
            title="Market data"
            items={[
              { label: "Category", value: <Badge tone="neutral">{titleCase(data?.category)}</Badge> },
              { label: "Unit", value: data?.unit ?? "—" },
              { label: "Price", value: <span className="font-mono">{fmtPrice(data?.reference_price)}</span> },
              {
                label: "24h",
                value: (
                  <span className={changeT === "success" ? "text-success" : changeT === "danger" ? "text-danger" : "text-muted"}>
                    {fmtChange(data?.change_24h)}
                  </span>
                ),
              },
              { label: "24h high", value: <span className="font-mono">{fmtPrice(data?.high_24h)}</span> },
              { label: "24h low", value: <span className="font-mono">{fmtPrice(data?.low_24h)}</span> },
              { label: "Volume", value: <span className="font-mono">{fmtNumber(data?.volume_24h)}</span> },
              { label: "Updated", value: fmtDate(data?.updated_at) },
            ]}
          />
          <Card>
            <CardHeader title="Trade" />
            <div className="flex flex-col gap-2">
              <Link href="/marketplace" className="text-sm text-brand hover:underline">
                Marketplace listings →
              </Link>
              <Link href="/order-book" className="text-sm text-brand hover:underline">
                Order book →
              </Link>
              <Link href="/grading" className="text-sm text-brand hover:underline">
                Quality grading →
              </Link>
            </div>
          </Card>
        </>
      }
    >
      {isLoading ? (
        <LoadingState label="Loading commodity…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          <Card className="text-markets">
            <CardHeader title="Price history" action={<span className="font-mono text-sm text-fg">{fmtPrice(data?.reference_price)}</span>} />
            {series.length > 0 ? (
              <AreaChart data={series} height={180} colorClassName="text-markets" ariaLabel={`${symbol} price history`} />
            ) : (
              <p className="py-8 text-center text-sm text-muted">No price history available.</p>
            )}
          </Card>

          {data?.description ? (
            <Card>
              <CardHeader title="About" />
              <p className="text-sm text-muted">{data.description}</p>
            </Card>
          ) : null}

          <Card className="p-0">
            <div className="p-5 pb-2">
              <CardHeader title="Recent harvests" description={`Latest harvested lots for ${symbol}.`} />
            </div>
            <div className="p-5 pt-0">
              <DataTable
                columns={harvestColumns}
                rows={harvests.items}
                getRowKey={(h) => h.id}
                isLoading={harvests.isLoading}
                error={harvests.error}
                onRetry={harvests.refetch}
                emptyTitle="No harvests"
                emptyDescription="Harvested lots for this commodity will appear here."
              />
            </div>
          </Card>
        </>
      )}
    </DetailShell>
  );
}
