import Link from "next/link";
import type { Address, Hex } from "viem";
import { shortenHex } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { attestationStatus, dealStatus, type StatusView } from "./provenanceFormat";
import type { DealStateValue } from "@/lib/types";

interface PassportCardProps {
  readonly batchId: Hex;
  readonly supplier: Address;
  readonly attested: boolean;
  readonly score?: number;
  readonly dealState: DealStateValue;
  readonly threshold: number;
}

/** A digital product passport tile — one card per registered batch. */
export function PassportCard({ batchId, supplier, attested, score, dealState, threshold }: PassportCardProps) {
  const att: StatusView = attestationStatus(attested, score, threshold);
  const deal: StatusView = dealStatus(dealState);
  return (
    <Link href={`/passports/${batchId}`}>
      <Card className="h-full transition-colors hover:border-dpp/50">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-dpp">
            <Icon name="passport" size={20} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-sm text-fg">{shortenHex(batchId, 8, 6)}</p>
            <p className="text-xs text-muted">Digital product passport</p>
          </div>
        </div>
        <div className="mt-4">
          <AddressBadge address={supplier} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge status={att.status}>{att.label}</StatusBadge>
          <StatusBadge status={deal.status}>{deal.label}</StatusBadge>
        </div>
      </Card>
    </Link>
  );
}
