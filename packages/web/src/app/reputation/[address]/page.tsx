"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useReputation } from "@/hooks/useReputation";
import { useActorProfile } from "@/hooks/useActorProfile";
import { normalizeAddress } from "@/lib/directory";
import { getErrorMessage } from "@/lib/errors";
import { formatBps } from "@/lib/format";
import { DetailShell } from "@/components/shells/DetailShell";
import { PageHeader } from "@/components/page";
import { Card, CardHeader } from "@/components/ui/Card";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { ErrorState, EmptyState } from "@/components/ui/States";
import { ReputationStats } from "@/components/reputation/ReputationStats";
import { GradeBadge } from "@/components/reputation/GradeBadge";

/**
 * Reputation detail (WD §2 DetailShell): the composite risk grade (ScoreOracle)
 * and underlying reputation stats (ReputationEngine) for a single address.
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
  const rep = reputation.reputation;
  const header = (
    <PageHeader
      icon="reputation"
      title={name || "Reputation"}
      breadcrumbs={[{ label: "Identity" }, { label: "Reputation" }, { label: name || "Detail" }]}
      actions={
        supplier.profile ? (
          <Link href={`/suppliers/${account}`}>
            <Button variant="secondary" size="sm">
              Supplier profile
            </Button>
          </Link>
        ) : null
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
              {reputation.gradeAvailable ? <GradeBadge grade={reputation.grade} /> : null}
            </div>
          </Card>
          <StatCard
            label="Pass rate"
            value={formatBps(rep.passRateBps)}
            loading={reputation.isLoading}
          />
          <StatCard label="Settled deals" value={rep.totalDeals} loading={reputation.isLoading} />
        </>
      }
    >
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
            <ReputationStats reputation={rep} loading={reputation.isLoading} />
            {!reputation.isLoading && !reputation.hasReputation ? (
              <p className="text-sm text-muted">
                No settled deals recorded for this address yet — reputation accrues as its deals
                settle on-chain.
              </p>
            ) : null}
          </div>
        )}
      </Card>
    </DetailShell>
  );
}
