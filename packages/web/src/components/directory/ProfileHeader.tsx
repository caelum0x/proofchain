import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { formatTimestamp } from "@/lib/format";
import type { ActorProfileView } from "@/lib/directory";
import { MetadataLink } from "./MetadataLink";

/**
 * Header card for an actor detail page (supplier / buyer). Shows the display
 * name, copyable address, registration date, and profile URI, with a slot for
 * role/grade badges and one for actions.
 */
export function ProfileHeader({
  profile,
  roleLabel,
  badges,
  actions,
}: {
  profile: ActorProfileView;
  roleLabel?: string;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-fg">
              {profile.name || "Unnamed account"}
            </h1>
            {roleLabel ? (
              <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs uppercase tracking-wide text-muted">
                {roleLabel}
              </span>
            ) : null}
          </div>
          <AddressBadge address={profile.account} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span>Registered {formatTimestamp(profile.registeredAt)}</span>
            <span className="inline-flex items-center gap-1">
              Profile: <MetadataLink uri={profile.uri} />
            </span>
          </div>
          {badges ? <div className="flex flex-wrap gap-2 pt-1">{badges}</div> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </Card>
  );
}
