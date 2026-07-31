import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/States";

export interface NotDeployedStateProps {
  /** Human-readable name(s) of the contract(s) backing this page. */
  readonly contract: string;
  readonly action?: ReactNode;
}

/**
 * Consistent "not available on this network" body used when a page's backing
 * contract is not deployed/configured on the active chain — an actionable state
 * instead of a blank screen (WD §3.5).
 */
export function NotDeployedState({ contract, action }: NotDeployedStateProps) {
  return (
    <EmptyState
      title="Not available on this network"
      description={`The ${contract} contract is not deployed for the configured chain.`}
      action={action}
    />
  );
}
