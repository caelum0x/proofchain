import { cn } from "@/lib/cn";
import { formatTokenAmount } from "@/lib/format";

export interface MoneyProps {
  readonly amount: bigint;
  readonly decimals: number;
  readonly symbol?: string;
  /** Emphasise the figure (larger, bolder). */
  readonly strong?: boolean;
  readonly className?: string;
}

/**
 * Tabular, mono-figure token amount with an optional ticker (WD §1: JetBrains
 * Mono + tabular numerals for all money). Presentational only.
 */
export function Money({ amount, decimals, symbol, strong = false, className }: MoneyProps) {
  return (
    <span className={cn("font-mono tabular-nums", strong && "text-base font-semibold text-fg", className)}>
      {formatTokenAmount(amount, decimals)}
      {symbol ? <span className="ml-1 text-muted">{symbol}</span> : null}
    </span>
  );
}
