import type { ReactNode } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { Callout } from "@/components/ui/Callout";
import { EmptyState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import type { IconName } from "@/components/ui/Icon";
import type { Crumb } from "@/components/ui/Breadcrumbs";

export interface ModuleKpi {
  readonly label: string;
  readonly hint?: string;
}

export interface ModulePlaceholderProps {
  readonly title: string;
  readonly subtitle: string;
  readonly icon: IconName;
  readonly breadcrumbs: readonly Crumb[];
  /** Placeholder KPI labels shown as an empty (—) row for layout continuity. */
  readonly kpis: readonly ModuleKpi[];
  /** What this module will track once its registry is deployed. */
  readonly description: ReactNode;
}

/**
 * A production-grade "module not yet on-chain" state for sustainability
 * sub-registries that have no deployed contract on the active network (water
 * credits, biodiversity, green bonds). Uses the standard page template so the
 * route reads as the same machine — never a blank screen — and points users to
 * the live sustainability modules.
 */
export function ModulePlaceholder({ title, subtitle, icon, breadcrumbs, kpis, description }: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        accentClassName="text-sustainability"
        breadcrumbs={breadcrumbs}
      />

      <KpiRow items={kpis.map((k) => ({ label: k.label, value: "—", hint: k.hint }))} />

      <Callout tone="info" title="Registry not deployed on this network">
        {description}
      </Callout>

      <EmptyState
        title="No on-chain records yet"
        description="This registry has no deployed contract on the active network. Connect to a network where it is live, or explore the sustainability modules that are already tracking on-chain data."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/carbon">
              <Button variant="secondary" size="sm">Carbon market</Button>
            </Link>
            <Link href="/recs">
              <Button variant="secondary" size="sm">RECs</Button>
            </Link>
            <Link href="/esg">
              <Button variant="secondary" size="sm">ESG scores</Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
