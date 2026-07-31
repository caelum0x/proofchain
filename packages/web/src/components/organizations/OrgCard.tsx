import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { formatTimestamp, shortenHex } from "@/lib/format";
import type { OrganizationView } from "@/lib/directory";
import { orgTypeLabel, orgTypeTone } from "./orgType";

/**
 * Directory tile for an organization, linking to its detail page. The org id is
 * a bytes32 key; we pass it through the route so the detail page can re-read it.
 */
export function OrgCard({ org }: { org: OrganizationView }) {
  return (
    <Link href={`/organizations/${org.orgId}`} className="block">
      <Card className="h-full transition-colors hover:border-brand/40">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-semibold text-fg">
            {org.name || "Unnamed org"}
          </p>
          <Badge tone={orgTypeTone(org.orgType)}>{orgTypeLabel(org.orgType)}</Badge>
        </div>
        <p className="mt-2 font-mono text-xs text-muted">{shortenHex(org.orgId, 8, 6)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Admin</span>
          <AddressBadge address={org.admin} copyable={false} />
        </div>
        <p className="mt-2 text-xs text-muted">
          Created {formatTimestamp(org.createdAt)}
        </p>
      </Card>
    </Link>
  );
}
