import type { IconName } from "@/components/ui/Icon";

/** An analytics domain surfaced on /analytics and /analytics/[domain]. */
export interface AnalyticsDomain {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: IconName;
  /** Tailwind text-color accent class for the domain. */
  readonly accentClassName: string;
}

/**
 * The analytics domain catalog. Each domain is a lens over the same on-chain +
 * API dataset; the detail page computes its metrics from live provenance and
 * settlement state (WD §6 Overview → Analytics).
 */
export const ANALYTICS_DOMAINS: readonly AnalyticsDomain[] = [
  {
    id: "provenance",
    label: "Provenance",
    description: "Registered batches, checkpoints, and supply-chain coverage.",
    icon: "batches",
    accentClassName: "text-dpp",
  },
  {
    id: "verification",
    label: "Verification",
    description: "AI attestation throughput, pass rate, and score distribution.",
    icon: "verifier",
    accentClassName: "text-compliance",
  },
  {
    id: "settlement",
    label: "Settlement",
    description: "Escrow funding, releases, disputes, and settled value.",
    icon: "deals",
    accentClassName: "text-finance",
  },
];

export function findAnalyticsDomain(id: string): AnalyticsDomain | undefined {
  return ANALYTICS_DOMAINS.find((d) => d.id === id);
}
