import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { formatTimestamp } from "@/lib/format";
import type { ActorProfileView } from "@/lib/directory";

interface ProfileCardProps {
  readonly profile: ActorProfileView;
  /** Detail route (e.g. `/suppliers`); the address is appended. Omit for no link. */
  readonly hrefBase?: string;
  /** Short role label shown as an accent (e.g. "Supplier"). */
  readonly roleLabel?: string;
}

/**
 * Compact directory tile for a supplier/buyer/carrier profile. Links to the
 * actor's detail page when `hrefBase` is provided; otherwise renders as a static
 * card (used for carriers, which have no dedicated detail route).
 */
export function ProfileCard({ profile, hrefBase, roleLabel }: ProfileCardProps) {
  const body = (
    <Card className="h-full transition-colors hover:border-brand/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">
            {profile.name || "Unnamed"}
          </p>
          {roleLabel ? (
            <p className="mt-0.5 text-xs uppercase tracking-wide text-muted">{roleLabel}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <AddressBadge address={profile.account} explorer={!hrefBase} />
      </div>
      <p className="mt-3 text-xs text-muted">
        Registered {formatTimestamp(profile.registeredAt)}
      </p>
    </Card>
  );

  if (!hrefBase) return body;
  return (
    <Link href={`${hrefBase}/${profile.account}`} className="block">
      {body}
    </Link>
  );
}
