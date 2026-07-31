"use client";

import { useRegistryDirectory } from "@/hooks/useRegistryDirectory";
import { ProfileGrid } from "@/components/directory/ProfileGrid";

/**
 * Carrier directory: logistics carriers registered in `CarrierRegistry`. These
 * are the actors authorised to push IoT/location checkpoints into provenance.
 * Carriers have no dedicated detail page, so the cards are non-linking.
 */
export default function CarriersPage() {
  const { profiles, isLoading, isError, error, notDeployed, refetch } =
    useRegistryDirectory("CarrierRegistry", "CarrierRegistered");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Carriers</h1>
        <p className="mt-1 text-sm text-muted">
          Logistics carriers that transport shipments and push provenance checkpoints.
        </p>
      </div>

      <ProfileGrid
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
