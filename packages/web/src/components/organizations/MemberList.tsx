import Link from "next/link";
import type { Address } from "viem";
import { EmptyState } from "@/components/ui/States";
import { AddressBadge } from "@/components/ui/AddressBadge";

/**
 * Live member roster for an organization, reconstructed from add/remove events.
 * Each row links to the member's supplier profile (a reasonable default entry
 * point into their on-chain activity).
 */
export function MemberList({ members }: { members: readonly Address[] }) {
  if (members.length === 0) {
    return (
      <EmptyState
        title="No members yet"
        description="This organization has not added any members on-chain."
      />
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {members.map((member) => (
        <li key={member} className="flex items-center justify-between gap-3 py-2.5">
          <AddressBadge address={member} />
          <Link
            href={`/suppliers/${member}`}
            className="text-xs text-brand hover:underline"
          >
            View profile →
          </Link>
        </li>
      ))}
    </ul>
  );
}
