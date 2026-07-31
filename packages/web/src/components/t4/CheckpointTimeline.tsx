import { Timeline, type TimelineEvent } from "@/components/ui/Timeline";
import { EmptyState } from "@/components/ui/States";
import type { CheckpointItem } from "@/hooks/logisticsCheckpoints";
import { TempBadge } from "./TempBadge";
import type { TempWindow } from "./temp";

export interface CheckpointTimelineProps {
  readonly checkpoints: readonly CheckpointItem[];
  readonly window?: TempWindow;
}

/**
 * Renders a shipment's checkpoint trail (origin → destination) as a vertical
 * timeline, each stop carrying its location and cold-chain temperature reading.
 * Expects checkpoints in chronological order.
 */
export function CheckpointTimeline({ checkpoints, window }: CheckpointTimelineProps) {
  if (checkpoints.length === 0) {
    return <EmptyState title="No checkpoints yet" description="This shipment has no recorded checkpoints." />;
  }

  const events: TimelineEvent[] = checkpoints.map((cp, index) => {
    const isFirst = index === 0;
    const isLast = index === checkpoints.length - 1;
    return {
      id: `${cp.transactionHash}-${cp.logIndex}`,
      title: cp.location || "Checkpoint",
      timestamp: `#${cp.blockNumber.toString()}`,
      tone: isLast ? "success" : isFirst ? "brand" : "info",
      meta: <TempBadge temp={cp.temp} window={window} />,
      description: isFirst ? "Origin" : isLast ? "Latest position" : undefined,
    };
  });

  return <Timeline events={events} />;
}
