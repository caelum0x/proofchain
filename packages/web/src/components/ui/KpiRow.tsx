import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { StatCard } from "./StatCard";
import type { ToneName } from "@/lib/format";

export interface Kpi {
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly hint?: ReactNode;
  readonly hintTone?: ToneName;
  readonly icon?: ReactNode;
  readonly loading?: boolean;
}

export interface KpiRowProps {
  readonly items: readonly Kpi[];
  readonly loading?: boolean;
  readonly className?: string;
}

/**
 * The `KpiRow` from WD §3 — a responsive row of 3–5 StatCards summarising a
 * resource. Pass `loading` to render every card in its skeleton state.
 */
export function KpiRow({ items, loading, className }: KpiRowProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4", className)}>
      {items.map((kpi, index) => (
        <StatCard
          key={index}
          label={kpi.label}
          value={kpi.value}
          hint={kpi.hint}
          hintTone={kpi.hintTone}
          icon={kpi.icon}
          loading={loading ?? kpi.loading}
        />
      ))}
    </div>
  );
}
