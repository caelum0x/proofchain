"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { useOverviewMetrics } from "@/hooks/overviewMetrics";
import { formatBps } from "@/lib/format";
import { PageHeader } from "@/components/page/PageHeader";
import { KpiRow, type Kpi } from "@/components/ui/KpiRow";
import { Card, CardHeader } from "@/components/ui/Card";
import { BarChart, DonutChart, type SeriesPoint } from "@/components/ui/Charts";
import { ErrorState } from "@/components/ui/States";
import { findAnalyticsDomain } from "@/components/t1/analyticsDomains";

/** Overview → Analytics → domain drill-down. Per-domain KPIs + charts, live. */
export default function AnalyticsDomainPage() {
  const params = useParams<{ domain: string }>();
  const raw = Array.isArray(params.domain) ? params.domain[0] : params.domain;
  const domain = raw ? findAnalyticsDomain(raw) : undefined;
  const m = useOverviewMetrics();

  if (!domain) {
    return (
      <ErrorState
        title="Unknown domain"
        message="No analytics are available for this domain. Return to the analytics overview."
      />
    );
  }

  let kpis: readonly Kpi[] = [];
  let chart: ReactNode = null;

  if (domain.id === "provenance") {
    kpis = [
      { label: "Registered batches", value: m.batches, loading: m.isLoading },
      { label: "Checkpoints", value: m.checkpoints, loading: m.isLoading },
      { label: "Avg checkpoints / batch", value: m.batches ? (m.checkpoints / m.batches).toFixed(1) : "—", loading: m.isLoading },
      { label: "Attested share", value: m.batches ? formatBps(Math.round((m.attestations / m.batches) * 10000)) : "—", hintTone: "brand", loading: m.isLoading },
    ];
    const bars: readonly SeriesPoint[] = [
      { x: "Batches", y: m.batches },
      { x: "Checkpoints", y: m.checkpoints },
      { x: "Attested", y: m.attestations },
    ];
    chart = (
      <Card>
        <CardHeader title="Coverage" description="Provenance records recorded on-chain." />
        <BarChart data={bars} colorClassName="text-dpp" height={180} ariaLabel="Provenance coverage" />
      </Card>
    );
  } else if (domain.id === "verification") {
    kpis = [
      { label: "Attestations", value: m.attestations, loading: m.isLoading },
      { label: "Pass rate", value: m.attestations ? formatBps(m.passRateBps) : "—", hintTone: "success", loading: m.isLoading },
      { label: "Avg score", value: m.attestations ? formatBps(m.avgScoreBps) : "—", hintTone: "brand", loading: m.isLoading },
      { label: "Failed", value: m.failed, hintTone: "danger", loading: m.isLoading },
    ];
    chart = (
      <Card>
        <CardHeader title="Verdict split" description="Passed vs failed attestations." />
        {m.attestations === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No attestations yet.</p>
        ) : (
          <div className="flex items-center gap-6">
            <DonutChart
              slices={[
                { label: "Passed", value: m.passed, colorClassName: "text-success" },
                { label: "Failed", value: m.failed, colorClassName: "text-danger" },
              ]}
              ariaLabel="Verdict split"
            />
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-success" />Passed <span className="font-mono text-fg">{m.passed}</span></li>
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-danger" />Failed <span className="font-mono text-fg">{m.failed}</span></li>
            </ul>
          </div>
        )}
      </Card>
    );
  } else {
    // settlement
    kpis = [
      { label: "Funded", value: m.funded, hintTone: "brand", loading: m.isLoading },
      { label: "Settled", value: m.released, hintTone: "success", loading: m.isLoading },
      { label: "Disputed", value: m.disputed, hintTone: "danger", loading: m.isLoading },
      { label: "Refunded", value: m.refunded, hintTone: "warn", loading: m.isLoading },
    ];
    const bars: readonly SeriesPoint[] = [
      { x: "Funded", y: m.funded },
      { x: "Settled", y: m.released },
      { x: "Disputed", y: m.disputed },
      { x: "Refunded", y: m.refunded },
    ];
    chart = (
      <Card>
        <CardHeader title="Settlement lifecycle" description="Escrow events across the network." />
        <BarChart data={bars} colorClassName="text-finance" height={180} ariaLabel="Settlement lifecycle" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={domain.icon}
        accentClassName={domain.accentClassName}
        breadcrumbs={[{ label: "Analytics", href: "/analytics" }, { label: domain.label }]}
        title={`${domain.label} analytics`}
        subtitle={domain.description}
      />
      <KpiRow items={kpis} />
      {chart}
    </div>
  );
}
