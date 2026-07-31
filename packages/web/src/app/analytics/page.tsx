"use client";

import Link from "next/link";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useOverviewMetrics } from "@/hooks/overviewMetrics";
import { formatBps } from "@/lib/format";
import { PageHeader } from "@/components/page/PageHeader";
import { KpiRow, type Kpi } from "@/components/ui/KpiRow";
import { Card } from "@/components/ui/Card";
import { CardGrid } from "@/components/ui/CardGrid";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";
import { ANALYTICS_DOMAINS, type AnalyticsDomain } from "@/components/t1/analyticsDomains";

/** Overview → Analytics. Cross-domain metrics with drill-down into each domain. */
export default function AnalyticsPage() {
  const { health, apiError } = useAnalytics();
  const m = useOverviewMetrics();
  const apiOnline = health !== null && !apiError;

  const kpis: readonly Kpi[] = [
    { label: "Batches", value: m.batches, loading: m.isLoading },
    { label: "Checkpoints", value: m.checkpoints, loading: m.isLoading },
    { label: "Attestations", value: m.attestations, hint: `${formatBps(m.passRateBps)} pass`, hintTone: "success", loading: m.isLoading },
    { label: "Settlements", value: m.released, hint: `${m.disputed} disputed`, hintTone: "brand", loading: m.isLoading },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="analytics"
        breadcrumbs={[{ label: "Overview" }, { label: "Analytics" }]}
        title="Analytics"
        subtitle="Network metrics by domain, computed live from on-chain state."
        actions={<StatusBadge status={apiOnline ? "success" : "warn"}>{apiOnline ? "API live" : "On-chain only"}</StatusBadge>}
      />

      <KpiRow items={kpis} />

      <CardGrid<AnalyticsDomain>
        items={ANALYTICS_DOMAINS}
        getKey={(d) => d.id}
        minColWidth={280}
        renderItem={(d) => (
          <Link href={`/analytics/${d.id}`}>
            <Card className="h-full transition-colors hover:border-brand/40">
              <div className="flex items-start gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 ${d.accentClassName}`}>
                  <Icon name={d.icon} size={20} />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-fg">{d.label}</p>
                  <p className="mt-1 text-sm text-muted">{d.description}</p>
                </div>
              </div>
              <p className="mt-4 inline-flex items-center gap-1 text-sm text-brand">
                View metrics <Icon name="arrow-right" size={14} />
              </p>
            </Card>
          </Link>
        )}
      />
    </div>
  );
}
