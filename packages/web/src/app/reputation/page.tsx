"use client";

import { useMemo } from "react";
import { useRegistryDirectory } from "@/hooks/useRegistryDirectory";
import { PageHeader, KpiRow } from "@/components/page";
import { ActorDirectory } from "@/components/t6/ActorDirectory";

/**
 * Reputation directory (WD §3): the registered suppliers whose on-chain track
 * record feeds the ScoreOracle grade. Selecting an actor opens their reputation
 * detail (composite risk grade + underlying ReputationEngine stats).
 */
export default function ReputationDirectoryPage() {
  const { profiles, isLoading, isError, error, notDeployed, refetch } = useRegistryDirectory(
    "SupplierRegistry",
    "SupplierRegistered",
  );

  const named = useMemo(() => profiles.filter((p) => p.name.trim().length > 0).length, [profiles]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="reputation"
        title="Reputation"
        subtitle="On-chain reputation scores and history for registered network participants."
        breadcrumbs={[{ label: "Explore" }, { label: "Reputation" }]}
      />

      <KpiRow
        items={[
          { label: "Scored actors", value: profiles.length, loading: isLoading },
          { label: "With profile name", value: named, loading: isLoading },
        ]}
      />

      <ActorDirectory
        profiles={profiles}
        isLoading={isLoading}
        isError={isError}
        error={error}
        notDeployed={notDeployed}
        onRetry={refetch}
        hrefBase="/reputation"
        roleLabel="Participant"
        emptyTitle="No scored participants yet"
        emptyDescription="Reputation scores appear here once participants build an on-chain track record."
        notDeployedLabel="The SupplierRegistry contract is not deployed on the configured network."
      />
    </div>
  );
}
