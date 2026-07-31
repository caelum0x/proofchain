import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { Icon, type IconName } from "@/components/ui/Icon";

export interface PageHeaderProps {
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly breadcrumbs?: readonly Crumb[];
  /** Right-aligned actions (primary/secondary buttons). */
  readonly actions?: ReactNode;
  /** Optional leading icon + accent text class (e.g. "text-finance"). */
  readonly icon?: IconName;
  readonly accentClassName?: string;
  readonly className?: string;
}

/**
 * The standard page header (WD §3.1): breadcrumbs, title, subtitle, and
 * right-aligned actions. Used at the top of every resource page.
 */
export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  icon,
  accentClassName = "text-brand",
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2", accentClassName)}>
              <Icon name={icon} size={20} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-fg">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
