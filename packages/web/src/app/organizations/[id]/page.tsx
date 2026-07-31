"use client";

import { useParams } from "next/navigation";
import type { Hex } from "viem";
import { isBytes32 } from "@/lib/hashing";
import { useOrganization } from "@/hooks/useOrganization";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestamp, shortenHex } from "@/lib/format";
import { DetailShell } from "@/components/shells/DetailShell";
import { PageHeader } from "@/components/page";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { StatCard } from "@/components/ui/StatCard";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { MemberList } from "@/components/organizations/MemberList";
import { MetadataLink } from "@/components/directory/MetadataLink";
import { orgTypeLabel, orgTypeTone } from "@/components/organizations/orgType";

/**
 * Organization detail (WD §2 DetailShell): the registry record in the main
 * column, with metadata + membership stats in a sticky rail.
 */
export default function OrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  const orgId = raw && isBytes32(raw) ? (raw as Hex) : undefined;

  const { organization, members, isLoading, isError, error, notDeployed, refetch } =
    useOrganization(orgId);

  const header = (
    <PageHeader
      icon="organizations"
      title={organization?.name || "Organization"}
      subtitle={orgId ? shortenHex(orgId, 10, 8) : undefined}
      breadcrumbs={[
        { label: "Identity" },
        { label: "Organizations", href: "/organizations" },
        { label: organization?.name || "Detail" },
      ]}
      actions={
        organization ? (
          <Badge tone={orgTypeTone(organization.orgType)}>{orgTypeLabel(organization.orgType)}</Badge>
        ) : null
      }
    />
  );

  if (!orgId) {
    return (
      <ErrorState
        title="Invalid organization id"
        message="The URL does not contain a valid 32-byte organization id."
      />
    );
  }

  if (notDeployed) {
    return (
      <ErrorState
        title="Registry not deployed"
        message="The OrganizationRegistry contract is not deployed on the configured network."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingState label="Loading organization…" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState
          title="Organization not found"
          message={`No organization is registered under id ${shortenHex(orgId, 8, 6)}.`}
        />
      </div>
    );
  }

  return (
    <DetailShell
      header={header}
      rail={
        <>
          <StatCard label="Members" value={members.length} />
          <Card>
            <CardHeader title="Metadata" />
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Organization id</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-fg">{orgId}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Admin</dt>
                <dd className="mt-0.5">
                  <AddressBadge address={organization.admin} />
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Created</dt>
                <dd className="mt-0.5 text-fg">{formatTimestamp(organization.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Type</dt>
                <dd className="mt-0.5 text-fg">{orgTypeLabel(organization.orgType)}</dd>
              </div>
              {organization.metadataURI ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Document</dt>
                  <dd className="mt-0.5">
                    <MetadataLink uri={organization.metadataURI} className="text-brand hover:underline" />
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </>
      }
    >
      <Card>
        <CardHeader
          title="Members"
          description="Current members reconstructed from on-chain membership events."
        />
        <MemberList members={members} />
      </Card>
    </DetailShell>
  );
}
