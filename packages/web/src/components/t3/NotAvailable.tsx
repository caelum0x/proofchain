import { EmptyState } from "@/components/ui";

export interface NotAvailableProps {
  readonly resource: string;
  readonly reason?: string;
}

/**
 * A consistent "not available on this network" body for pages whose backing
 * contract or API endpoint is not deployed/configured on the active chain —
 * an actionable state instead of a blank screen (WD §3.5).
 */
export function NotAvailable({ resource, reason }: NotAvailableProps) {
  return (
    <EmptyState
      title={`${resource} is not available on this network`}
      description={
        reason ??
        `The contracts or API backing ${resource.toLowerCase()} are not deployed for the configured chain. Switch networks or configure the deployment to continue.`
      }
    />
  );
}
