"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useReputation } from "@/hooks/useReputation";
import { useActorProfile } from "@/hooks/useActorProfile";
import { normalizeAddress } from "@/lib/directory";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Button } from "@/components/ui/Button";
import { ErrorState, EmptyState } from "@/components/ui/States";
import { ReputationStats } from "@/components/reputation/ReputationStats";
import { GradeBadge } from "@/components/reputation/GradeBadge";

/**
 * Reputation detail for a single address: the composite risk grade
 * (ScoreOracle) and the underlying reputation stats (ReputationEngine). Links
 * back to the supplier profile when the address is a registered supplier.
 */
export default function ReputationPage() {
  const params = useParams<{ address: string }>();
  const raw = Array.isArray(params.address) ? params.address[0] : params.address;
  const account = normalizeAddress(raw);

  const reputation = useReputation(account);
  const supplier = useActorProfile("SupplierRegistry", account);

  if (!account) {
    return (
      <ErrorState
        title="Invalid address"
        message="The URL does not contain a valid 0x… wallet address."
      />
    );
  }

  const name = supplier.profile?.name;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{name || "Reputation"}</h1>
              {reputation.gradeAvailable ? <GradeBadge grade={reputation.grade} /> : null}
            </div>
            <AddressBadge address={account} />
          </div>
          {supplier.profile ? (
            <Link href={`/suppliers/${account}`}>
              <Button variant="secondary" size="sm">
                Supplier profile
              </Button>
            </Link>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Reputation stats"
          description="Recorded on every settlement outcome by the reputation engine."
        />
        {reputation.notDeployed ? (
          <EmptyState
            title="Reputation engine not deployed"
            description="The ReputationEngine contract is not available on this network."
          />
        ) : reputation.isError ? (
          <ErrorState message={getErrorMessage(reputation.error)} onRetry={reputation.refetch} />
        ) : (
          <div className="space-y-4">
            <ReputationStats reputation={reputation.reputation} loading={reputation.isLoading} />
            {!reputation.isLoading && !reputation.hasReputation ? (
              <p className="text-sm text-muted">
                No settled deals recorded for this address yet — reputation accrues as its deals
                settle on-chain.
              </p>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}
