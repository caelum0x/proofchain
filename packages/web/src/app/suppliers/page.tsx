"use client";

import { useMemo } from "react";
import { useRegistryDirectory } from "@/hooks/useRegistryDirectory";
import { PageHeader, KpiRow } from "@/components/page";
import { ActorDirectory } from "@/components/t6/ActorDirectory";

/**
 * Supplier directory (WD §3): every account registered in `SupplierRegistry`,
 * with a link into each supplier's profile + on-chain track record.
 */
export default function SuppliersPage() {
  const { profiles, isLoading, isError, error, notDeployed, refetch } = useRegistryDirectory(
    "SupplierRegistry",
    "SupplierRegistered",
  );

  const named = useMemo(() => profiles.filter((p) => p.name.trim().length > 0).length, [profiles]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="suppliers"
        title="Suppliers"
        subtitle="Registered suppliers across the ProofChain network and their track record."
        breadcrumbs={[{ label: "Identity" }, { label: "Suppliers" }]}
      />

      <KpiRow
        items={[
          { label: "Suppliers", value: profiles.length, loading: isLoading },
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
        hrefBase="/suppliers"
        roleLabel="Supplier"
        emptyTitle="No suppliers registered yet"
        emptyDescription="Suppliers appear here once they register on-chain."
        notDeployedLabel="The SupplierRegistry contract is not deployed on the configured network."
      />
    </div>
  );
}
