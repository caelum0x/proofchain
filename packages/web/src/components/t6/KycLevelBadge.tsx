import { StatusBadge } from "@/components/ui/StatusBadge";
import { KYC_LEVEL_LABEL } from "@/hooks/useKyc";
import type { SemanticStatus } from "@/components/ui/StatusBadge";

const TONE: Record<number, SemanticStatus> = {
  0: "neutral",
  1: "info",
  2: "success",
  3: "brand",
};

/** Renders a KYC verification level as a semantic pill. */
export function KycLevelBadge({ level }: { level: number }) {
  return (
    <StatusBadge status={TONE[level] ?? "neutral"} dot>
      {KYC_LEVEL_LABEL[level] ?? "Unknown"}
    </StatusBadge>
  );
}
