import { Timeline, type TimelineEvent } from "@/components/ui/Timeline";
import { TxLink } from "@/components/ui/TxLink";
import { EmptyState } from "@/components/ui/States";
import { formatTimestamp } from "@/lib/format";
import type { TimelineItem, TimelineKind } from "@/lib/types";
import type { SemanticStatus } from "@/components/ui/StatusBadge";

const KIND_TONE: Record<TimelineKind, SemanticStatus> = {
  registered: "neutral",
  checkpoint: "info",
  funded: "brand",
  attested: "success",
  released: "success",
  disputed: "danger",
  refunded: "warn",
};

/**
 * Renders a batch/deal lifecycle timeline from decoded {@link TimelineItem}s on
 * the design-system `Timeline`, colouring each event by kind and linking its tx.
 */
export function DealTimeline({ items }: { items: readonly TimelineItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="No events yet" description="Lifecycle events will appear here as the batch progresses." />;
  }

  const events: TimelineEvent[] = items.map((item, i) => ({
    id: `${item.kind}-${i}`,
    title: item.title,
    tone: KIND_TONE[item.kind],
    timestamp: item.timestamp ? formatTimestamp(item.timestamp) : undefined,
    description: item.description,
    meta: item.txHash ? <TxLink hash={item.txHash} /> : undefined,
  }));

  return <Timeline events={events} />;
}
