import Link from "next/link";
import type { Hex } from "viem";
import { shortenHex } from "@/lib/format";
import { CopyButton } from "@/components/ui/CopyButton";

interface BatchIdCellProps {
  readonly batchId: Hex;
  /** Route prefix for the detail link (e.g. "/batches", "/explorer"). */
  readonly href?: string;
  readonly copyable?: boolean;
}

/**
 * Monospace batch-id cell with copy + optional detail link. Standardises how a
 * bytes32 batch id renders across every provenance list.
 */
export function BatchIdCell({ batchId, href, copyable = true }: BatchIdCellProps) {
  const label = shortenHex(batchId, 8, 6);
  return (
    <span className="inline-flex items-center gap-1.5">
      {href ? (
        <Link href={`${href}/${batchId}`} className="font-mono text-xs text-brand hover:underline">
          {label}
        </Link>
      ) : (
        <span className="font-mono text-xs text-fg">{label}</span>
      )}
      {copyable ? <CopyButton value={batchId} /> : null}
    </span>
  );
}
