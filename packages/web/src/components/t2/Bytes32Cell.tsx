import Link from "next/link";
import { cn } from "@/lib/cn";
import { shortenHex } from "@/lib/format";

export interface Bytes32CellProps {
  readonly value: string;
  /** When provided, renders as a link to this href. */
  readonly href?: string;
  readonly lead?: number;
  readonly tail?: number;
  readonly className?: string;
}

/**
 * Compact, mono-truncated bytes32 identifier (batch id / action key), optionally
 * linking to its detail page. Full value available on hover via `title`.
 */
export function Bytes32Cell({ value, href, lead = 6, tail = 6, className }: Bytes32CellProps) {
  const label = shortenHex(value, lead, tail);
  const base = cn("font-mono text-sm tabular-nums", className);
  if (href) {
    return (
      <Link href={href} title={value} className={cn(base, "text-fg transition-colors hover:text-brand")}>
        {label}
      </Link>
    );
  }
  return (
    <span title={value} className={cn(base, "text-fg/90")}>
      {label}
    </span>
  );
}
