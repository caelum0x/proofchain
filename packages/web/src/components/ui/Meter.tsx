import { cn } from "@/lib/cn";

export interface MeterProps {
  /** Value in [min, max]. */
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  /** Thresholds; value below `low` is danger, below `high` is warn, else success. */
  readonly low?: number;
  readonly high?: number;
  /** Invert so that lower is better (e.g. risk). */
  readonly invert?: boolean;
  readonly label?: string;
  readonly showValue?: boolean;
  readonly className?: string;
}

/**
 * A semantic gauge that colours itself by threshold (like `<meter>`), used for
 * scores, ratios, capacity, and risk. Distinct from `Progress`, which is a
 * neutral loading/percentage bar.
 */
export function Meter({
  value,
  min = 0,
  max = 100,
  low,
  high,
  invert = false,
  label,
  showValue = true,
  className,
}: MeterProps) {
  const span = max - min || 1;
  const pct = Math.max(0, Math.min(100, ((value - min) / span) * 100));
  const lowT = low ?? min + span * 0.33;
  const highT = high ?? min + span * 0.66;

  let tone = "bg-success";
  const good = invert ? value <= lowT : value >= highT;
  const bad = invert ? value >= highT : value <= lowT;
  if (bad) tone = "bg-danger";
  else if (!good) tone = "bg-warn";

  return (
    <div className={cn("space-y-1", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs">
          {label ? <span className="text-muted">{label}</span> : <span />}
          {showValue ? <span className="font-mono text-fg">{value}</span> : null}
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-pill bg-surface-2"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={label}
      >
        <div className={cn("h-full rounded-pill transition-[width] duration-slow", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
