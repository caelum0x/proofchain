"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { Hex } from "viem";
import { isBytes32 } from "@/lib/hashing";
import { useOrganization } from "@/hooks/useOrganization";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestamp, shortenHex } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { StatCard } from "@/components/ui/StatCard";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { MemberList } from "@/components/organizations/MemberList";
import { MetadataLink } from "@/components/directory/MetadataLink";
import { orgTypeLabel, orgTypeTone } from "@/components/organizations/orgType";

/**
 * Organization detail: its registry record plus the live member roster
 * reconstructed from `MemberAdded` / `MemberRemoved` events.
 */
export default function OrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  const orgId = raw && isBytes32(raw) ? (raw as Hex) : undefined;

  const { organization, members, isLoading, isError, error, notDeployed, refetch } =
    useOrganization(orgId);

  if (!orgId) {
    return (
      <ErrorState
        title="Invalid organization id"
        message="The URL does not contain a valid 32-byte organization id."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/organizations" className="text-xs text-muted hover:text-fg">
          ← All organizations
        </Link>
      </div>

      {notDeployed ? (
        <ErrorState
          title="Registry not deployed"
          message="The OrganizationRegistry contract is not deployed on the configured network."
        />
      ) : isLoading ? (
        <LoadingState label="Loading organization…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : !organization ? (
        <ErrorState
          title="Organization not found"
          message={`No organization is registered under id ${shortenHex(orgId, 8, 6)}.`}
        />
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold">{organization.name || "Unnamed org"}</h1>
                  <Badge tone={orgTypeTone(organization.orgType)}>
                    {orgTypeLabel(organization.orgType)}
                  </Badge>
                </div>
                <p className="font-mono text-xs text-muted">{orgId}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    Admin <AddressBadge address={organization.admin} />
                  </span>
                  <span>Created {formatTimestamp(organization.createdAt)}</span>
                </div>
                {organization.metadataURI ? (
                  <p className="text-xs text-muted">
                    Metadata:{" "}
                    <MetadataLink
                      uri={organization.metadataURI}
                      className="text-brand hover:underline"
                    />
                  </p>
                ) : null}
              </div>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Members" value={members.length} />
            <StatCard label="Type" value={orgTypeLabel(organization.orgType)} />
          </div>

          <Card>
            <CardHeader
              title="Members"
              description="Current members reconstructed from on-chain membership events."
            />
            <MemberList members={members} />
          </Card>
        </>
      )}
    </div>
  );
}
