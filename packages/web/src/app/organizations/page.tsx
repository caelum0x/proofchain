"use client";

import { useMemo, useState } from "react";
import { useOrganizations } from "@/hooks/useOrganizations";
import { getErrorMessage } from "@/lib/errors";
import { Input } from "@/components/ui/Field";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/States";
import { OrgCard } from "@/components/organizations/OrgCard";

/**
 * Organization directory: every org registered in `OrganizationRegistry`,
 * filterable by name or id, each linking to its detail + membership page.
 */
export default function OrganizationsPage() {
  const { organizations, isLoading, isError, error, notDeployed, refetch } =
    useOrganizations();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.orgId.toLowerCase().includes(q) ||
        o.admin.toLowerCase().includes(q),
    );
  }, [organizations, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organizations</h1>
        <p className="mt-1 text-sm text-muted">
          Organizations that suppliers, buyers, and carriers belong to.
        </p>
      </div>

      {notDeployed ? (
        <EmptyState
          title="Registry not deployed"
          description="The OrganizationRegistry contract is not deployed on the configured network."
        />
      ) : isLoading ? (
        <LoadingState label="Loading organizations from chain…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      ) : organizations.length === 0 ? (
        <EmptyState
          title="No organizations registered yet"
          description="Organizations appear here once they register on-chain."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, id, or admin…"
              className="max-w-sm"
              aria-label="Search organizations"
            />
            <p className="text-xs text-muted">
              {filtered.length} of {organizations.length}
            </p>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No matches" description="No organizations match your search." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((org) => (
                <OrgCard key={org.orgId} org={org} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
