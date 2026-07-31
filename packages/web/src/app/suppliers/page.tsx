"use client";

import { useRegistryDirectory } from "@/hooks/useRegistryDirectory";
import { ProfileGrid } from "@/components/directory/ProfileGrid";

/**
 * Supplier directory: every account registered in `SupplierRegistry`, with a
 * link into each supplier's profile + on-chain track record.
 */
export default function SuppliersPage() {
  const { profiles, isLoading, isError, error, notDeployed, refetch } =
    useRegistryDirectory("SupplierRegistry", "SupplierRegistered");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <p className="mt-1 text-sm text-muted">
          Registered suppliers across the ProofChain network and their track record.
        </p>
      </div>

      <ProfileGrid
        profiles={profiles}
        isLoading={isLoading}
        isError={isError}
        error={error}
        notDeployed={notDeployed}
        onRetry={refetch}
        hrefBase="/suppliers"
        roleLabel="Supplier"
        emptyTitle="No suppliers registered yet"
        emptyDescription="Suppliers appear here once they register on-chain."
        notDeployedLabel="The SupplierRegistry contract is not deployed on the configured network."
      />
    </div>
  );
}
