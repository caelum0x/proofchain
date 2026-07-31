import { Badge } from "@/components/ui/Badge";
import { formatBps, type ToneName } from "@/lib/format";

function tone(score: number): ToneName {
  if (score >= 7000) return "success";
  if (score >= 4000) return "warn";
  return "danger";
}

/** Badge rendering an ESG score (basis points) with a risk-graded tone. */
export function EsgScoreBadge({ score }: { score: number }) {
  return <Badge tone={tone(score)}>{formatBps(score)}</Badge>;
}
