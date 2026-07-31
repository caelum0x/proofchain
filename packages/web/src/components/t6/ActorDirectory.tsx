"use client";

import { useMemo } from "react";
import type { ActorProfileView } from "@/lib/directory";
import { useTableParams } from "@/hooks/useTableParams";
import { getErrorMessage } from "@/lib/errors";
import { Toolbar, AsyncBoundary, SearchParamsBoundary } from "@/components/page";
import { Input } from "@/components/ui/Field";
import { Callout } from "@/components/ui/Callout";
import { Skeleton } from "@/components/ui/Skeleton";
import { CardGrid } from "@/components/ui/CardGrid";
import { ProfileCard } from "@/components/directory/ProfileCard";

interface ActorDirectoryProps {
  readonly profiles: readonly ActorProfileView[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error?: unknown;
  readonly notDeployed?: boolean;
  readonly onRetry?: () => void;
  readonly hrefBase?: string;
  readonly roleLabel: string;
  readonly emptyTitle: string;
  readonly emptyDescription?: string;
  readonly notDeployedLabel: string;
}

/**
 * URL-searchable actor directory body (WD §3): a Toolbar + CardGrid of
 * ProfileCards with loading / error / empty state layers. Filtering is
 * client-side over the fetched set and reflected in the `q` search param.
 */
function ActorDirectoryContent({
  profiles,
  isLoading,
  isError,
  error,
  notDeployed = false,
  onRetry,
  hrefBase,
  roleLabel,
  emptyTitle,
  emptyDescription,
  notDeployedLabel,
}: ActorDirectoryProps) {
  const params = useTableParams({ defaultView: "grid" });

  const filtered = useMemo(() => {
    const q = params.search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) => p.name.toLowerCase().includes(q) || p.account.toLowerCase().includes(q),
    );
  }, [profiles, params.search]);

  if (notDeployed) {
    return (
      <Callout tone="warn" title="Registry not deployed">
        {notDeployedLabel}
      </Callout>
    );
  }

  return (
    <div className="space-y-4">
      <Toolbar
        actions={
          !isLoading && !isError ? (
            <p className="text-xs text-muted">
              {filtered.length} of {profiles.length}
            </p>
          ) : null
        }
      >
        <Input
          value={params.search}
          onChange={(e) => params.setSearch(e.target.value)}
          placeholder="Search by name or address…"
          className="max-w-xs"
          aria-label="Search directory"
        />
      </Toolbar>

      <AsyncBoundary
        isLoading={isLoading}
        error={isError ? getErrorMessage(error) : null}
        onRetry={onRetry}
        isEmpty={filtered.length === 0}
        emptyTitle={params.search ? "No matches" : emptyTitle}
        emptyDescription={params.search ? "No profiles match your search." : emptyDescription}
        loading={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        }
      >
        <CardGrid
          items={filtered}
          getKey={(p) => p.account}
          minColWidth={280}
          renderItem={(profile) => (
            <ProfileCard profile={profile} hrefBase={hrefBase} roleLabel={roleLabel} />
          )}
        />
      </AsyncBoundary>
    </div>
  );
}

/** URL-searchable actor directory (self-wrapped in a Suspense boundary for `useSearchParams`). */
export function ActorDirectory(props: ActorDirectoryProps) {
  return (
    <SearchParamsBoundary>
      <ActorDirectoryContent {...props} />
    </SearchParamsBoundary>
  );
}
