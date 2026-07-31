import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { ToneName } from "@/lib/format";

interface StatCardProps {
  readonly label: ReactNode;
  readonly value: ReactNode;
  /** Secondary line under the value (e.g. "+12% this week"). */
  readonly hint?: ReactNode;
  /** Tone for the hint text. */
  readonly hintTone?: ToneName;
  /** Optional leading icon/graphic. */
  readonly icon?: ReactNode;
  readonly loading?: boolean;
  readonly className?: string;
}

const HINT_TONES: Record<ToneName, string> = {
  neutral: "text-muted",
  brand: "text-brand",
  success: "text-success",
  warn: "text-warn",
  danger: "text-danger",
};

/**
 * A single KPI tile: label, prominent value, and an optional hint. Renders a
 * skeleton when `loading` so dashboards avoid layout shift while data streams in.
 */
export function StatCard({
  label,
  value,
  hint,
  hintTone = "neutral",
  icon,
  loading = false,
  className,
}: StatCardProps) {
  return (
    <div className={cn("card flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        {loading ? (
          <div className="mt-2 h-7 w-24 animate-pulse rounded bg-surface-2" />
        ) : (
          <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-fg">{value}</p>
        )}
        {hint && !loading ? (
          <p className={cn("mt-1 text-xs", HINT_TONES[hintTone])}>{hint}</p>
        ) : null}
      </div>
      {icon ? (
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-brand">
          {icon}
        </div>
      ) : null}
    </div>
  );
}
