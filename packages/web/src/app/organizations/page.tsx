"use client";

import { useMemo } from "react";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useTableParams } from "@/hooks/useTableParams";
import { getErrorMessage } from "@/lib/errors";
import { PageHeader, Toolbar, KpiRow, AsyncBoundary, SearchParamsBoundary } from "@/components/page";
import { CardGrid } from "@/components/ui/CardGrid";
import { Input } from "@/components/ui/Field";
import { Callout } from "@/components/ui/Callout";
import { Skeleton } from "@/components/ui/Skeleton";
import { OrgCard } from "@/components/organizations/OrgCard";
import { orgTypeLabel } from "@/components/organizations/orgType";

/**
 * Organization directory (WD §3): every org registered in `OrganizationRegistry`,
 * searchable by name / id / admin, each linking to its detail + membership page.
 */
function OrganizationsPageContent() {
  const { organizations, isLoading, isError, error, notDeployed, refetch } = useOrganizations();
  const params = useTableParams({ defaultView: "grid" });

  const filtered = useMemo(() => {
    const q = params.search.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.orgId.toLowerCase().includes(q) ||
        o.admin.toLowerCase().includes(q),
    );
  }, [organizations, params.search]);

  const typeCount = useMemo(
    () => new Set(organizations.map((o) => orgTypeLabel(o.orgType))).size,
    [organizations],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon="organizations"
        title="Organizations"
        subtitle="Organizations that suppliers, buyers, and carriers belong to."
        breadcrumbs={[{ label: "Identity" }, { label: "Organizations" }]}
      />

      <KpiRow
        items={[
          { label: "Organizations", value: organizations.length, loading: isLoading },
          { label: "Distinct types", value: typeCount, loading: isLoading },
          { label: "Matching filter", value: filtered.length, loading: isLoading },
        ]}
      />

      {notDeployed ? (
        <Callout tone="warn" title="Registry not deployed">
          The OrganizationRegistry contract is not deployed on the configured network.
        </Callout>
      ) : (
        <div className="space-y-4">
          <Toolbar>
            <Input
              value={params.search}
              onChange={(e) => params.setSearch(e.target.value)}
              placeholder="Search by name, id, or admin…"
              className="max-w-sm"
              aria-label="Search organizations"
            />
          </Toolbar>

          <AsyncBoundary
            isLoading={isLoading}
            error={isError ? getErrorMessage(error) : null}
            onRetry={refetch}
            isEmpty={filtered.length === 0}
            emptyTitle={params.search ? "No matches" : "No organizations registered yet"}
            emptyDescription={
              params.search
                ? "No organizations match your search."
                : "Organizations appear here once they register on-chain."
            }
            loading={
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            }
          >
            <CardGrid
              items={filtered}
              getKey={(o) => o.orgId}
              minColWidth={280}
              renderItem={(org) => <OrgCard org={org} />}
            />
          </AsyncBoundary>
        </div>
      )}
    </div>
  );
}

export default function OrganizationsPage() {
  return (
    <SearchParamsBoundary>
      <OrganizationsPageContent />
    </SearchParamsBoundary>
  );
}
