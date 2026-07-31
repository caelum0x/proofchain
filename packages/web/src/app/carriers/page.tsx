"use client";

import { useMemo } from "react";
import { useRegistryDirectory } from "@/hooks/useRegistryDirectory";
import { PageHeader, KpiRow } from "@/components/page";
import { ActorDirectory } from "@/components/t6/ActorDirectory";

/**
 * Carrier directory (WD §3): logistics carriers registered in `CarrierRegistry`
 * — the actors authorised to push IoT/location checkpoints into provenance.
 */
export default function CarriersPage() {
  const { profiles, isLoading, isError, error, notDeployed, refetch } = useRegistryDirectory(
    "CarrierRegistry",
    "CarrierRegistered",
  );

  const named = useMemo(() => profiles.filter((p) => p.name.trim().length > 0).length, [profiles]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="carriers"
        title="Carriers"
        subtitle="Logistics carriers that transport shipments and push provenance checkpoints."
        breadcrumbs={[{ label: "Identity" }, { label: "Carriers" }]}
      />

      <KpiRow
        items={[
          { label: "Carriers", value: profiles.length, loading: isLoading },
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
        roleLabel="Carrier"
        emptyTitle="No carriers registered yet"
        emptyDescription="Carriers appear here once they register on-chain."
        notDeployedLabel="The CarrierRegistry contract is not deployed on the configured network."
      />
    </div>
  );
}
