"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useActorProfile } from "@/hooks/useActorProfile";
import { useReputation } from "@/hooks/useReputation";
import { useSupplierBatches } from "@/hooks/useSupplierBatches";
import { normalizeAddress } from "@/lib/directory";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingState, EmptyState } from "@/components/ui/States";
import { ProfileHeader } from "@/components/directory/ProfileHeader";
import { BatchList } from "@/components/directory/BatchList";
import { ReputationStats } from "@/components/reputation/ReputationStats";
import { GradeBadge } from "@/components/reputation/GradeBadge";

/**
 * Supplier profile: identity (SupplierRegistry), on-chain reputation +
 * risk grade (ReputationEngine / ScoreOracle), and every batch they registered.
 */
export default function SupplierProfilePage() {
  const params = useParams<{ address: string }>();
  const raw = Array.isArray(params.address) ? params.address[0] : params.address;
  const account = normalizeAddress(raw);

  const profileResult = useActorProfile("SupplierRegistry", account);
  const reputation = useReputation(account);
  const batches = useSupplierBatches(account);

  if (!account) {
    return (
      <ErrorState
        title="Invalid address"
        message="The URL does not contain a valid 0x… wallet address."
      />
    );
  }

  return (
    <div className="space-y-6">
      {profileResult.isLoading ? (
        <LoadingState label="Loading supplier profile…" />
      ) : profileResult.isError ? (
        <ErrorState
          message={getErrorMessage(profileResult.error)}
          onRetry={profileResult.refetch}
        />
      ) : !profileResult.profile ? (
        <UnregisteredCard account={account} />
      ) : (
        <ProfileHeader
          profile={profileResult.profile}
          roleLabel="Supplier"
          badges={reputation.gradeAvailable ? <GradeBadge grade={reputation.grade} /> : null}
          actions={
            <Link href={`/reputation/${account}`}>
              <Button variant="secondary" size="sm">
                Reputation detail
              </Button>
            </Link>
          }
        />
      )}

      <Card>
        <CardHeader
          title="Reputation"
          description="Aggregated outcomes recorded on settlement."
        />
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
    </div>
  );
}

function UnregisteredCard({ account }: { account: string }) {
  return (
    <Card>
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Unregistered supplier</h1>
        <div className="flex items-center gap-2 text-sm text-muted">
          <span>This address has no SupplierRegistry profile:</span>
          <AddressBadge address={account} />
        </div>
        <p className="text-sm text-muted">
          Their on-chain reputation and any registered batches are still shown below if present.
        </p>
      </div>
    </Card>
  );
}
