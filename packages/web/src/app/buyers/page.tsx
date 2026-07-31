"use client";

import { useMemo } from "react";
import { useRegistryDirectory } from "@/hooks/useRegistryDirectory";
import { PageHeader, KpiRow } from "@/components/page";
import { ActorDirectory } from "@/components/t6/ActorDirectory";

/**
 * Buyer directory (WD §3): every account registered in `BuyerRegistry`, with a
 * link into each buyer's profile and the escrow deals they funded.
 */
export default function BuyersPage() {
  const { profiles, isLoading, isError, error, notDeployed, refetch } = useRegistryDirectory(
    "BuyerRegistry",
    "BuyerRegistered",
  );

  const named = useMemo(() => profiles.filter((p) => p.name.trim().length > 0).length, [profiles]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="buyers"
        title="Buyers"
        subtitle="Registered buyers across the ProofChain network and the deals they fund."
        breadcrumbs={[{ label: "Identity" }, { label: "Buyers" }]}
      />

      <KpiRow
        items={[
          { label: "Buyers", value: profiles.length, loading: isLoading },
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
        hrefBase="/buyers"
        roleLabel="Buyer"
        emptyTitle="No buyers registered yet"
        emptyDescription="Buyers appear here once they register on-chain."
        notDeployedLabel="The BuyerRegistry contract is not deployed on the configured network."
      />
    </div>
  );
}
