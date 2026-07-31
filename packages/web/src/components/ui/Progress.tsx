import { cn } from "@/lib/cn";
import type { SemanticStatus } from "./StatusBadge";

export interface ProgressProps {
  /** Current value. */
  readonly value: number;
  /** Maximum value (default 100). */
  readonly max?: number;
  readonly tone?: SemanticStatus;
  /** Accessible label. */
  readonly label?: string;
  readonly className?: string;
}

const BAR_TONE: Record<SemanticStatus, string> = {
  neutral: "bg-muted",
  info: "bg-info",
  success: "bg-success",
  warn: "bg-warn",
  danger: "bg-danger",
  brand: "bg-brand",
};

/** A determinate progress bar (percentage of `max`). */
export function Progress({ value, max = 100, tone = "brand", label, className }: ProgressProps) {
  const safeMax = max <= 0 ? 1 : max;
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-pill bg-surface-2", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-pill transition-[width] duration-slow", BAR_TONE[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
