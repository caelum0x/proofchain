import type { ReactNode } from "react";
import { PageHeader } from "@/components/page/PageHeader";
import { Toolbar, FilterBar } from "@/components/page/Toolbar";
import { KpiRow, type Kpi } from "@/components/ui/KpiRow";
import type { Crumb } from "@/components/ui/Breadcrumbs";
import type { IconName } from "@/components/ui/Icon";

export interface ResourceListViewProps {
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly breadcrumbs?: readonly Crumb[];
  readonly icon?: IconName;
  /** Accent text class for the header icon (e.g. "text-markets"). */
  readonly accentClassName?: string;
  /** Right-aligned header actions (primary/secondary buttons). */
  readonly actions?: ReactNode;
  /** KPI summary row (WD §3.2). Omit to hide. */
  readonly kpis?: readonly Kpi[];
  readonly kpisLoading?: boolean;
  /** Toolbar left cluster — search + filter facets. */
  readonly toolbar?: ReactNode;
  /** Toolbar right cluster — sort/view/export. */
  readonly toolbarActions?: ReactNode;
  /** The body: DataTable / CardGrid / Dashboard + Pagination. */
  readonly children: ReactNode;
}

/**
 * The canonical list-page scaffold (WD §3): PageHeader → KpiRow → Toolbar →
 * body. Every workforce + markets list page composes this so a credential list,
 * a commodity list, and an order book read as the same machine with different
 * columns. The body (DataTable/CardGrid) carries its own loading/empty/error
 * layers, so callers pass those through their body component.
 */
export function ResourceListView({
  title,
  subtitle,
  breadcrumbs,
  icon,
  accentClassName,
  actions,
  kpis,
  kpisLoading,
  toolbar,
  toolbarActions,
  children,
}: ResourceListViewProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        icon={icon}
        accentClassName={accentClassName}
        actions={actions}
      />

      {kpis && kpis.length > 0 ? <KpiRow items={kpis} loading={kpisLoading} /> : null}

      {toolbar || toolbarActions ? (
        <Toolbar actions={toolbarActions}>
          {toolbar ? <FilterBar>{toolbar}</FilterBar> : null}
        </Toolbar>
      ) : null}

      <div className="space-y-4">{children}</div>
    </div>
  );
}
