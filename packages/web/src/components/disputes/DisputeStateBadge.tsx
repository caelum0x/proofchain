import { Badge } from "@/components/ui/Badge";
import type { ToneName } from "@/lib/format";
import { ArbDisputeState, type ArbDisputeStateValue } from "@/hooks/useDisputes";

const LABEL: Record<ArbDisputeStateValue, string> = {
  [ArbDisputeState.None]: "Not opened",
  [ArbDisputeState.Open]: "Voting open",
  [ArbDisputeState.Resolved]: "Resolved",
};

const TONE: Record<ArbDisputeStateValue, ToneName> = {
  [ArbDisputeState.None]: "neutral",
  [ArbDisputeState.Open]: "warn",
  [ArbDisputeState.Resolved]: "success",
};

/** Badge for the on-chain arbitration lifecycle of a disputed deal. */
export function DisputeStateBadge({ state }: { state: ArbDisputeStateValue }) {
  return <Badge tone={TONE[state]}>{LABEL[state]}</Badge>;
}
