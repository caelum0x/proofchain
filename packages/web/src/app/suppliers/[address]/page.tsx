"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useActorProfile } from "@/hooks/useActorProfile";
import { useReputation } from "@/hooks/useReputation";
import { useSupplierBatches } from "@/hooks/useSupplierBatches";
import { useBondAccount } from "@/hooks/useBond";
import { normalizeAddress } from "@/lib/directory";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestamp, formatTokenAmount } from "@/lib/format";
import { DetailShell } from "@/components/shells/DetailShell";
import { PageHeader } from "@/components/page";
import { Card, CardHeader } from "@/components/ui/Card";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { ErrorState, LoadingState, EmptyState } from "@/components/ui/States";
import { BatchList } from "@/components/directory/BatchList";
import { ReputationStats } from "@/components/reputation/ReputationStats";
import { GradeBadge } from "@/components/reputation/GradeBadge";

/**
 * Supplier profile (WD §2 DetailShell): identity (SupplierRegistry), on-chain
 * reputation + risk grade, posted bond, and every batch they registered.
 */
export default function SupplierProfilePage() {
  const params = useParams<{ address: string }>();
  const raw = Array.isArray(params.address) ? params.address[0] : params.address;
  const account = normalizeAddress(raw);

  const profileResult = useActorProfile("SupplierRegistry", account);
  const reputation = useReputation(account);
  const batches = useSupplierBatches(account);
  const bond = useBondAccount(account ?? undefined);

  if (!account) {
    return (
      <ErrorState
        title="Invalid address"
        message="The URL does not contain a valid 0x… wallet address."
      />
    );
  }

  const name = profileResult.profile?.name;
  const header = (
    <PageHeader
      icon="suppliers"
      title={name || "Supplier"}
      breadcrumbs={[
        { label: "Identity" },
        { label: "Suppliers", href: "/suppliers" },
        { label: name || "Profile" },
      ]}
      actions={
        <Link href={`/reputation/${account}`}>
          <Button variant="secondary" size="sm">
            Reputation detail
          </Button>
        </Link>
      }
    />
  );

  return (
    <DetailShell
      header={header}
      rail={
        <>
          <Card>
            <CardHeader title="Identity" />
            <div className="space-y-3 text-sm">
              <AddressBadge address={account} />
              <div className="flex flex-wrap items-center gap-2">
                {reputation.gradeAvailable ? <GradeBadge grade={reputation.grade} /> : null}
              </div>
              {profileResult.profile ? (
                <p className="text-xs text-muted">
                  Registered {formatTimestamp(profileResult.profile.registeredAt)}
                </p>
              ) : (
                <p className="text-xs text-warn">No SupplierRegistry profile for this address.</p>
              )}
            </div>
          </Card>
          <StatCard
            label="Posted bond"
            value={bond.deployed ? formatTokenAmount(bond.total, 18) : "—"}
            hint={bond.deployed ? `${formatTokenAmount(bond.locked, 18)} locked` : undefined}
            loading={bond.isLoading}
          />
        </>
      }
    >
      {profileResult.isLoading ? (
        <LoadingState label="Loading supplier profile…" />
      ) : profileResult.isError ? (
        <ErrorState message={getErrorMessage(profileResult.error)} onRetry={profileResult.refetch} />
      ) : null}

      <Card>
        <CardHeader title="Reputation" description="Aggregated outcomes recorded on settlement." />
        {reputation.notDeployed ? (
          <EmptyState
            title="Reputation engine not deployed"
            description="The ReputationEngine contract is not available on this network."
          />
        ) : (
          <ReputationStats reputation={reputation.reputation} loading={reputation.isLoading} />
        )}
      </Card>

      <Card>
        <CardHeader
          title="Registered batches"
          description="Provenance records created by this supplier."
        />
        <BatchList
          batches={batches.batches}
          isLoading={batches.isLoading}
          isError={batches.isError}
          error={batches.isError ? getErrorMessage(batches.error) : null}
          onRetry={batches.refetch}
        />
      </Card>
    </DetailShell>
  );
}
