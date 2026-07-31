import { Badge } from "@/components/ui/Badge";
import type { ToneName } from "@/lib/format";
import { PROPOSAL_STATE_LABEL } from "@/hooks/useGovernance";

const TONE: Record<number, ToneName> = {
  0: "neutral", // Pending
  1: "brand", // Active
  2: "neutral", // Canceled
  3: "danger", // Defeated
  4: "success", // Succeeded
  5: "warn", // Queued
  6: "neutral", // Expired
  7: "success", // Executed
};

/** Badge for an OZ Governor proposal state. */
export function ProposalStateBadge({ state }: { state: number | undefined }) {
  if (state === undefined) return <Badge tone="neutral">—</Badge>;
  return <Badge tone={TONE[state] ?? "neutral"}>{PROPOSAL_STATE_LABEL[state] ?? "Unknown"}</Badge>;
}
